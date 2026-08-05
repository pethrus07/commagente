// 🖥️ Apresentação — biblioteca de mídia (upload/listar/apagar). [§8.15]
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { excluirMidia, listarMidias, subirMidia } from './midia.caso-uso'

const corpo = z.object({
  nome: z.string().min(1),
  mimetype: z.string().default('application/octet-stream'),
  base64: z.string().min(1),
})

export async function midiaRotas(app: FastifyInstance) {
  app.get('/midia', async () => listarMidias())

  // upload em base64 — bodyLimit maior (arquivo passa do limite padrão)
  app.post('/midia', { bodyLimit: 20 * 1024 * 1024 }, async (req, reply) => {
    const dados = corpo.parse(req.body)
    reply.code(201)
    return subirMidia(dados)
  })

  app.delete('/midia/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return excluirMidia(id)
  })
}
