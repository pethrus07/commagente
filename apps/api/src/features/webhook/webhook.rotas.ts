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
    // ACK IMEDIATO + processa em BACKGROUND (fire-and-forget): segurar a resposta fazia a
    // transcrição de áudio (Whisper + download) estourar o timeout da Evolution → reentrega
    // em loop + custo dobrado. Devolver erro também causaria reentrega, por isso o .catch loga.
    void processarWebhook(req.body).catch((err) =>
      app.log.error({ err }, 'falha ao processar webhook'),
    )
    return { ok: true }
  }

  // Verificação do webhook da Meta (Cloud API): a Meta faz um GET com hub.challenge no setup.
  // Responde o challenge SE o hub.verify_token bater com CLOUD_API_VERIFY_TOKEN. (Evolution não usa GET.)
  const verify = async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string | undefined>
    if (
      config.cloud.verifyToken &&
      q['hub.mode'] === 'subscribe' &&
      q['hub.verify_token'] === config.cloud.verifyToken
    ) {
      reply.type('text/plain')
      return q['hub.challenge'] ?? ''
    }
    reply.code(403)
    return { ok: false }
  }

  app.get('/webhook', verify)
  app.get('/webhook/:segredo', verify)
  app.post('/webhook', handler) // dev (sem segredo) — em prod devolve 404 se WEBHOOK_SECRET setado
  app.post('/webhook/:segredo', handler) // prod: segredo no caminho
}
