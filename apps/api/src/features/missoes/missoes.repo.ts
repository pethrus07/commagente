// 🔌 Infraestrutura — persistência de Missão (Prisma).
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const missoesRepo = {
  criar(data: {
    tenantId: string
    contatoId: string
    numeroId: string
    objetivo: string
    contexto?: string
    templateId?: string
  }) {
    return db.missao.create({ data })
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

  atualizarEstado(
    id: string,
    estado: EstadoMissao,
    extra?: Prisma.MissaoUpdateInput,
  ) {
    return db.missao.update({ where: { id }, data: { estado, ...extra } })
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
