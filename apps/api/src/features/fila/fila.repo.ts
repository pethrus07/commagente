// 🔌 Infraestrutura — a fila de envio (tabela fila_envio) e os contadores do número.
import type { Prisma, StatusEnvio } from '@prisma/client'
import { db } from '../../core/db.js'

export const filaRepo = {
  async enfileirar(p: {
    tenantId: string
    missaoId: string
    contatoId: string
    payload: Prisma.InputJsonValue
    agendadoPara: Date
  }) {
    // DEDUP (anti-repeteco): se já existe um item AINDA NÃO ENVIADO com o MESMO texto pra esta
    // missão, não cria outro. Defende contra qualquer re-disparo/re-trigger que empilharia a
    // mesma mensagem (o cliente via "bom dia" 2×). O envio em si já é idempotente pelo claim
    // atômico; isto evita a duplicata ainda na origem.
    const texto = (p.payload as { texto?: unknown })?.texto
    if (typeof texto === 'string' && texto) {
      const jaExiste = await db.filaEnvio.count({
        where: {
          missaoId: p.missaoId,
          status: { in: ['pendente', 'enviando'] },
          payload: { path: ['texto'], equals: texto },
        },
      })
      if (jaExiste > 0) return null
    }
    return db.filaEnvio.create({
      data: {
        tenantId: p.tenantId,
        missaoId: p.missaoId,
        contatoId: p.contatoId,
        payload: p.payload,
        agendadoPara: p.agendadoPara,
      },
    })
  },

  // itens pendentes já "vencidos" (agendado_para <= agora).
  // Janela AMPLA (20, não 3): o worker pula itens gated (fora da janela / anti-rajada /
  // chip fora) com `continue`; se pegasse só os 3 mais antigos e eles estivessem gated,
  // travava a fila inteira (um tenant em campanha/à noite bloqueava os outros — head-of-line).
  // O espaçamento real de envio continua pelo `proximoEnvioEm` por número (sem rajada).
  pegarDevidos(agora: Date, limite = 20) {
    return db.filaEnvio.findMany({
      where: { status: 'pendente', agendadoPara: { lte: agora } },
      orderBy: { agendadoPara: 'asc' },
      take: limite,
      // pausa (missão ou campanha) segura o envio do que já está na fila
      include: { missao: { select: { iaPausada: true, campanha: { select: { pausada: true } } } } },
    })
  },

  marcar(id: string, status: StatusEnvio, incTentativa = false) {
    return db.filaEnvio.update({
      where: { id },
      data: { status, ...(incTentativa ? { tentativas: { increment: 1 } } : {}) },
    })
  },

  // CLAIM ATÔMICO (anti-duplicação): tenta transicionar pendente→enviando de forma condicional.
  // Se dois ticks/loops concorrentes pegam o mesmo item em `pegarDevidos` (que não tranca a linha),
  // só UM ganha o UPDATE (o WHERE exige status='pendente'); o outro recebe count=0 e PULA o envio.
  // É o que garante que cada item sai UMA vez, independentemente de quantos loops rodem.
  async reivindicar(id: string): Promise<boolean> {
    const r = await db.filaEnvio.updateMany({
      where: { id, status: 'pendente' },
      data: { status: 'enviando' },
    })
    return r.count === 1
  },

  buscarNumero(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  // opt-out: contato pediu pra parar de receber?
  async contatoOptOut(contatoId: string): Promise<boolean> {
    const c = await db.contato.findUnique({
      where: { id: contatoId },
      select: { optOut: true },
    })
    return c?.optOut ?? false
  },

  incrementarEnviados(numeroId: string, por = 1) {
    return db.numeroWhatsapp.update({
      where: { id: numeroId },
      data: { enviadosHoje: { increment: por } },
    })
  },

  // vira o dia → zera o contador e carimba a nova data-ref
  resetarContador(numeroId: string, data: string) {
    return db.numeroWhatsapp.update({
      where: { id: numeroId },
      data: { enviadosHoje: 0, enviadosData: data },
    })
  },

  // anti-rajada: marca o próximo horário permitido de envio do número
  marcarProximoEnvio(numeroId: string, quando: Date) {
    return db.numeroWhatsapp.update({
      where: { id: numeroId },
      data: { proximoEnvioEm: quando },
    })
  },

  // retry: devolve o item pra fila (pendente) com nova data e +1 tentativa
  reagendar(id: string, quando: Date) {
    return db.filaEnvio.update({
      where: { id },
      data: { status: 'pendente', tentativas: { increment: 1 }, agendadoPara: quando },
    })
  },

  // ADIAR (anti head-of-line): empurra o agendamento pra frente SEM contar tentativa nem mudar
  // status. Usado quando o chip está fora do ar — em vez de deixar o item 'pendente' na FRENTE da
  // fila (onde `pegarDevidos` só via ele + os outros do mesmo chip caído, entupindo os 20 slots e
  // starvando itens novos de OUTROS chips), joga pro fim pra reavaliar quando o chip voltar.
  adiar(id: string, quando: Date) {
    return db.filaEnvio.update({ where: { id }, data: { agendadoPara: quando } })
  },

  // REAPER (no boot): itens presos em 'enviando' são de um processo que morreu (deploy/crash)
  // entre o claim e marcar('ok') — nada os re-seleciona. Volta pra 'pendente' pra não perder o
  // envio. ⚠️ SÓ recupera itens 'enviando' ANTIGOS (órfãos de verdade, > `idadeMinMs`): um envio
  // EM CURSO (claim recente) NÃO pode ser reinjetado, senão o worker manda a mesma mensagem de
  // novo (foi a causa do "repeteco" no teste do parceiro). O carimbo é `atualizadoEm` (@updatedAt).
  async reclamarPresos(idadeMinMs = 120_000): Promise<number> {
    const corte = new Date(Date.now() - idadeMinMs)
    const r = await db.filaEnvio.updateMany({
      where: { status: 'enviando', atualizadoEm: { lt: corte } },
      data: { status: 'pendente' },
    })
    return r.count
  },
}
