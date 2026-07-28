// 🔌 Infraestrutura — persistência do ingestor (Prisma).
import type { StatusEnvio } from '@prisma/client'
import { db } from '../../core/db'

export const webhookRepo = {
  acharNumeroPorInstancia(instancia: string) {
    return db.numeroWhatsapp.findFirst({
      where: { instanciaEvolution: instancia },
    })
  },

  // idempotência: já gravamos essa mensagem? (evita processar/responder 2×)
  existeMensagem(tenantId: string, providerMsgId: string) {
    return db.mensagem.findFirst({ where: { tenantId, providerMsgId } })
  },

  // opt-out: o contato pediu pra parar → bloqueia envios futuros
  marcarOptOut(contatoId: string) {
    return db.contato.update({
      where: { id: contatoId },
      data: { optOut: true, optOutEm: new Date() },
    })
  },

  // consentimento implícito (só grava se ainda não houver registro de opt-in)
  registrarOptInInbound(contatoId: string) {
    return db.contato.updateMany({
      where: { id: contatoId, optInEm: null },
      data: { optInEm: new Date(), optInOrigem: 'inbound' },
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
        // id vazio vira NULL: sob @@unique(tenantId, providerMsgId) os NULLs são DISTINTOS,
        // então duas msgs sem id não colidem (antes '' colidia → 2ª inbound sumia).
        providerMsgId: p.providerMsgId || null,
      },
    })
  },

  // mensagem que o OPERADOR digitou no celular (fromMe, não é envio nosso) → grava como 'out'
  // já 'ok' (o WhatsApp já entregou). Entra no histórico pra IA/painel não perderem.
  gravarMensagemSaidaOperador(p: {
    tenantId: string
    missaoId: string | null
    contatoId: string
    conteudo: string
    providerMsgId: string | null
  }) {
    return db.mensagem.create({
      data: {
        tenantId: p.tenantId,
        missaoId: p.missaoId ?? undefined,
        contatoId: p.contatoId,
        direcao: 'out',
        conteudo: p.conteudo,
        providerMsgId: p.providerMsgId || null,
        statusEnvio: 'ok',
        enviadaEm: new Date(),
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
