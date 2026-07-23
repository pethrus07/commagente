// 🖥️ Apresentação — recebe os eventos da Evolution (mensagens, status).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../../core/config'
import { processarWebhook } from './webhook.caso-uso'

export async function webhookRotas(app: FastifyInstance) {
  const handler = async (req: FastifyRequest, reply: FastifyReply) => {
    // Segurança: se há WEBHOOK_SECRET, só aceita /webhook/<segredo> com o valor certo.
    // 404 (não 401) pra não revelar que o endpoint existe. Vazio (dev) = sem checagem.
    const segredo = (req.params as { segredo?: string }).segredo
    if (config.webhookSecret && segredo !== config.webhookSecret) {
      reply.code(404)
      return { ok: false }
    }
    // Responde 200 rápido e engole erros: se devolvêssemos erro, a Evolution
    // re-tentaria o mesmo evento em loop. Falhas ficam no log.
    try {
      await processarWebhook(req.body)
    } catch (err) {
      app.log.error({ err }, 'falha ao processar webhook')
    }
    return { ok: true }
  }

  app.post('/webhook', handler) // dev (sem segredo) — em prod devolve 404 se WEBHOOK_SECRET setado
  app.post('/webhook/:segredo', handler) // prod: segredo no caminho
}
