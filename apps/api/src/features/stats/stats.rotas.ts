// 🖥️ Apresentação — métricas do dashboard.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { obterHistorico, obterStats } from './stats.caso-uso.js'

const queryHist = z.object({ dias: z.coerce.number().int().min(1).max(90).optional() })

export async function statsRotas(app: FastifyInstance) {
  app.get('/stats', async () => obterStats())
  app.get('/stats/historico', async (req) => {
    const { dias } = queryHist.parse(req.query)
    return obterHistorico(dias ?? 14)
  })
}
