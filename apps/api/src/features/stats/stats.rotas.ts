// 🖥️ Apresentação — métricas do dashboard.
import type { FastifyInstance } from 'fastify'
import { obterStats } from './stats.caso-uso'

export async function statsRotas(app: FastifyInstance) {
  app.get('/stats', async () => obterStats())
}
