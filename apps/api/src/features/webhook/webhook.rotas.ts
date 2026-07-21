// 🖥️ Apresentação — recebe os eventos da Evolution (mensagens, status).
import type { FastifyInstance } from 'fastify'
import { processarWebhook } from './webhook.caso-uso'

export async function webhookRotas(app: FastifyInstance) {
  app.post('/webhook', async (req) => {
    // Responde 200 rápido e engole erros: se devolvêssemos erro, a Evolution
    // re-tentaria o mesmo evento em loop. Falhas ficam no log.
    try {
      await processarWebhook(req.body)
    } catch (err) {
      app.log.error({ err }, 'falha ao processar webhook')
    }
    return { ok: true }
  })
}
