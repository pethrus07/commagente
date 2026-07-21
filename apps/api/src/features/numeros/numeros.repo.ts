// 🔌 Infraestrutura — persistência do NumeroWhatsapp (Prisma).
import type { StatusConexao } from '@prisma/client'
import { db } from '../../core/db'

export const numerosRepo = {
  criar(tenantId: string, telefone: string, instanciaEvolution: string) {
    return db.numeroWhatsapp.create({
      data: { tenantId, telefone, instanciaEvolution },
    })
  },

  buscar(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  atualizarStatus(id: string, statusConexao: StatusConexao) {
    return db.numeroWhatsapp.update({
      where: { id },
      data: { statusConexao },
    })
  },
}
