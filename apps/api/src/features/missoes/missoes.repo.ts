// 🔌 Infraestrutura — persistência de Missão (Prisma).
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const missoesRepo = {
  criar(data: {
    tenantId: string
    contatoId: string
    numeroId: string
    tipo?: string
    objetivo: string
    contexto?: string
    criterioConclusao?: string
    tom?: string
    informacoes?: string
    templateId?: string
    campanhaId?: string
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
        contato: true,
        numero: true,
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
