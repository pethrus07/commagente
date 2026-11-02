// 🔌 Infraestrutura — persistência do executor (Prisma).
import type { StatusEnvio } from '@prisma/client'
import { db } from '../../core/db.js'

export const envioRepo = {
  buscarNumero(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  upsertContato(tenantId: string, telefone: string) {
    return db.contato.upsert({
      where: { tenantId_telefone: { tenantId, telefone } },
      update: {},
      create: { tenantId, telefone, origem: 'manual' },
    })
  },

  gravarMensagemSaida(p: {
    tenantId: string
    missaoId: string | null
    contatoId: string
    conteudo: string
    providerMsgId: string
    statusEnvio: StatusEnvio
  }) {
    return db.mensagem.create({
      data: {
        tenantId: p.tenantId,
        missaoId: p.missaoId ?? undefined,
        contatoId: p.contatoId,
        direcao: 'out',
        conteudo: p.conteudo,
        providerMsgId: p.providerMsgId || null, // '' → NULL (distinto no @@unique; evita "poisoning")
        statusEnvio: p.statusEnvio,
        enviadaEm: new Date(),
      },
    })
  },
}
