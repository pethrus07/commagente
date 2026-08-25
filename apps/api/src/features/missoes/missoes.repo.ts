// 🔌 Infraestrutura — persistência de Missão (Prisma).
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const missoesRepo = {
  criar(data: {
    tenantId: string
    contatoId: string
    numeroId: string
    tipo?: string
    modo?: string
    objetivo: string
    contexto?: string
    criterioConclusao?: string
    tom?: string
    informacoes?: string
    midiaIds?: string[] // biblioteca curada desta missão (vazio → toda a biblioteca do tenant)
    dna?: Prisma.InputJsonValue // camada de DNA desta missão (#9 Fase C)
    estilo?: Prisma.InputJsonValue // perfil de conversa desta missão (null → herda tenant)
    templateId?: string
    campanhaId?: string
    estado?: EstadoMissao
    iniciadaEm?: Date
    iaPausada?: boolean
  }) {
    return db.missao.create({ data })
  },

  atualizar(id: string, data: Prisma.MissaoUpdateInput) {
    return db.missao.update({ where: { id }, data })
  },

  buscar(id: string) {
    return db.missao.findUnique({
      where: { id },
      include: {
        // tags do contato entram no contexto da IA (descrição = conhecimento sobre o contato)
        contato: { include: { tags: { include: { tag: { select: { nome: true, descricao: true } } } } } }, // memoria/dna vêm no include completo
        numero: true,
        tenant: { select: { persona: true, estilo: true, dna: true } }, // identidade + estilo + DNA da IA p/ o prompt
        campanha: { select: { nome: true, dna: true, midiaIds: true, pausada: true, roteiro: true } }, // nome + DNA + mídias + roteiro herdados + pausa da campanha
        mensagens: { orderBy: { criadaEm: 'asc' } },
      },
    })
  },

  listar(tenantId: string) {
    return db.missao.findMany({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' },
      include: { contato: true },
    })
  },

  // inbox de escalados: missões aguardando um humano + última mensagem (preview)
  listarEscalados(tenantId: string) {
    return db.missao.findMany({
      where: { tenantId, estado: 'escalada' },
      orderBy: { criadoEm: 'desc' },
      include: {
        contato: true,
        mensagens: { orderBy: { criadaEm: 'desc' }, take: 1 },
      },
    })
  },

  atualizarEstado(
    id: string,
    estado: EstadoMissao,
    extra?: Prisma.MissaoUpdateInput,
  ) {
    return db.missao.update({ where: { id }, data: { estado, ...extra } })
  },

  // quantas missões iniciadas (fora de 'configurada') o contato teve desde uma data
  // (anti-spam: cap de iniciações por contato)
  contarIniciadasPorContato(contatoId: string, desde: Date) {
    return db.missao.count({
      where: { contatoId, criadoEm: { gte: desde }, estado: { not: 'configurada' } },
    })
  },

  // missão "ativa" de um contato num número (pra ligar mensagens recebidas)
  acharAtivaPorContatoNumero(numeroId: string, contatoId: string) {
    return db.missao.findFirst({
      where: {
        numeroId,
        contatoId,
        estado: { in: ['na_fila', 'em_conversa', 'escalada'] },
      },
      orderBy: { criadoEm: 'desc' },
    })
  },
}
