// 🔌 Infraestrutura — persistência do ingestor (Prisma).
import type { StatusEnvio } from '@prisma/client'
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

  gravarMensagemEntrada(p: {
    tenantId: string
    missaoId: string | null
    contatoId: string
    conteudo: string
    providerMsgId: string
  }) {
    return db.mensagem.create({
      data: {
        tenantId: p.tenantId,
        missaoId: p.missaoId ?? undefined, // opcional: inbound pode não ter missão
        contatoId: p.contatoId,
        direcao: 'in',
        conteudo: p.conteudo,
        providerMsgId: p.providerMsgId,
      },
    })
  },

  // status de entrega/leitura → atualiza a mensagem de SAÍDA correspondente
  atualizarStatusSaida(providerMsgId: string, statusEnvio: StatusEnvio) {
    return db.mensagem.updateMany({
      where: { providerMsgId, direcao: 'out' },
      data: { statusEnvio },
    })
  },
}
