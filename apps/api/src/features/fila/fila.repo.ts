// 🔌 Infraestrutura — a fila de envio (tabela fila_envio) e os contadores do número.
import type { Prisma, StatusEnvio } from '@prisma/client'
import { db } from '../../core/db'

export const filaRepo = {
  enfileirar(p: {
    tenantId: string
    missaoId: string
    contatoId: string
    payload: Prisma.InputJsonValue
    agendadoPara: Date
  }) {
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

  // REAPER (no boot): itens presos em 'enviando' são de um processo que morreu (deploy/crash)
  // entre marcar('enviando') e marcar('ok') — nada os re-seleciona. Volta pra 'pendente' pra
  // não perder a resposta. (Risco baixo de duplicar se já tinha enviado; melhor que sumir.)
  async reclamarPresos(): Promise<number> {
    const r = await db.filaEnvio.updateMany({
      where: { status: 'enviando' },
      data: { status: 'pendente' },
    })
    return r.count
  },
}
