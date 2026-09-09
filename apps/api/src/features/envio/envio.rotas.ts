// 🖥️ Apresentação — envio manual de texto: a válvula de escape para o operador mandar algo
// pelo chip sem passar pela IA nem pela fila. Fora do caminho normal (o normal é a fila), por
// isso valida o dono do número antes de enviar.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enviarTextoManual } from './envio.caso-uso'

const corpo = z.object({
  numeroId: z.string().uuid(),
  telefone: z.string().min(8),
  texto: z.string().min(1),
  missaoId: z.string().uuid().optional(),
})

export async function envioRotas(app: FastifyInstance) {
  app.post('/envio', async (req) => {
    const { numeroId, telefone, texto, missaoId } = corpo.parse(req.body)
    return enviarTextoManual(numeroId, telefone, texto, missaoId)
  })
}
