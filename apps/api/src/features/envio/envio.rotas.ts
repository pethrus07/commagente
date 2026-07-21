// 🖥️ Apresentação — envio manual de texto (teste da Fatia 2).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enviarTexto } from './envio.caso-uso'

const corpo = z.object({
  numeroId: z.string().uuid(),
  telefone: z.string().min(8),
  texto: z.string().min(1),
})

export async function envioRotas(app: FastifyInstance) {
  app.post('/envio', async (req) => {
    const { numeroId, telefone, texto } = corpo.parse(req.body)
    return enviarTexto(numeroId, telefone, texto)
  })
}
