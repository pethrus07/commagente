// 🖥️ Apresentação — Central de Inteligência (#7): perguntar sobre os dados da conta.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { perguntarSobreDados } from './inteligencia.caso-uso.js'

export async function inteligenciaRotas(app: FastifyInstance) {
  app.post('/inteligencia/perguntar', async (req) => {
    const { pergunta } = z.object({ pergunta: z.string().min(1).max(500) }).parse(req.body)
    return perguntarSobreDados({ pergunta })
  })
}
