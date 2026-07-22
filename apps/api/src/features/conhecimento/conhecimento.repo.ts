// 🔌 Infraestrutura — persistência da base de conhecimento (memória coletiva).
import type { Prisma, StatusConhecimento } from '@prisma/client'
import { db } from '../../core/db'

export const conhecimentoRepo = {
  listar(tenantId: string) {
    return db.conhecimento.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
    })
  },

  // itens aprovados que a IA consulta ao responder (mais recentes primeiro)
  aprovados(tenantId: string, limite = 30) {
    return db.conhecimento.findMany({
      where: { tenantId, status: 'aprovado' },
      orderBy: { criadoEm: 'desc' },
      take: limite,
    })
  },

  buscar(id: string) {
    return db.conhecimento.findUnique({ where: { id } })
  },

  criar(data: {
    tenantId: string
    titulo: string
    conteudo: string
    status?: StatusConhecimento
    origem?: string
    missaoId?: string
  }) {
    return db.conhecimento.create({ data })
  },

  atualizar(id: string, data: Prisma.ConhecimentoUpdateInput) {
    return db.conhecimento.update({ where: { id }, data })
  },

  excluir(id: string) {
    return db.conhecimento.delete({ where: { id } })
  },

  // evita gravar a mesma sugestão duas vezes
  existeConteudo(tenantId: string, conteudo: string) {
    return db.conhecimento.findFirst({ where: { tenantId, conteudo } })
  },
}
