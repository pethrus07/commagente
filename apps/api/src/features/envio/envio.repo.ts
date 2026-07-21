// 🔌 Infraestrutura — persistência do executor (Prisma).
import { Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const envioRepo = {
  buscarNumero(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  registrarEvento(
    tenantId: string,
    tipo: string,
    dados: Prisma.InputJsonObject,
  ) {
    return db.evento.create({ data: { tenantId, tipo, dados } })
  },
}
