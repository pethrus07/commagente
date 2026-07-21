// 🖥️ Apresentação — rotas HTTP de missão.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { criarMissao, listarMissoes, obterMissao } from './missoes.caso-uso'

const corpoCriar = z.object({
  telefone: z.string().min(8),
  numeroId: z.string().uuid(),
  objetivo: z.string().min(1),
  contexto: z.string().optional(),
  nomeContato: z.string().optional(),
})

const paramsId = z.object({ id: z.string().uuid() })

export async function missoesRotas(app: FastifyInstance) {
  app.post('/missoes', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    const missao = await criarMissao(dados)
    reply.code(201)
    return missao
  })

  app.get('/missoes', async () => listarMissoes())

  app.get('/missoes/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return obterMissao(id)
  })
}
