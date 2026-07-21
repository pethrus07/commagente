// 🖥️ Apresentação — rotas HTTP de missão.
import { EstadoMissao } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  criarMissao,
  listarMissoes,
  mudarEstado,
  obterMissao,
} from './missoes.caso-uso'

const corpoCriar = z.object({
  telefone: z.string().min(8),
  numeroId: z.string().uuid(),
  objetivo: z.string().min(1),
  contexto: z.string().optional(),
  nomeContato: z.string().optional(),
})

const corpoEstado = z.object({ estado: z.nativeEnum(EstadoMissao) })

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

  // muda o estado (validado pela máquina de estados; 409 se inválido)
  app.post('/missoes/:id/estado', async (req) => {
    const { id } = paramsId.parse(req.params)
    const { estado } = corpoEstado.parse(req.body)
    return mudarEstado(id, estado)
  })
}
