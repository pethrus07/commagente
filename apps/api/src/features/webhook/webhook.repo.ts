// 🔌 Infraestrutura — persistência do ingestor (Prisma).
import { Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const webhookRepo = {
  acharNumeroPorInstancia(instancia: string) {
    return db.numeroWhatsapp.findFirst({
      where: { instanciaEvolution: instancia },
    })
  },

  upsertContato(tenantId: string, telefone: string, nome?: string) {
    return db.contato.upsert({
      where: { tenantId_telefone: { tenantId, telefone } },
      update: nome ? { nome } : {},
      create: { tenantId, telefone, nome, origem: 'whatsapp' },
    })
  },

  registrarEvento(
    tenantId: string,
    tipo: string,
    dados: Prisma.InputJsonObject,
    missaoId?: string,
  ) {
    return db.evento.create({ data: { tenantId, missaoId, tipo, dados } })
  },
}
