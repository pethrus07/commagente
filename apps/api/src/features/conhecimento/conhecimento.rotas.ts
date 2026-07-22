// 🖥️ Apresentação — rotas da base de conhecimento (memória coletiva).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  criarConhecimento,
  definirStatusConhecimento,
  editarConhecimento,
  excluirConhecimento,
  listarConhecimento,
} from './conhecimento.caso-uso'

const corpoCriar = z.object({
  titulo: z.string().min(1),
  conteudo: z.string().min(1),
})
const corpoEditar = z.object({
  titulo: z.string().min(1).optional(),
  conteudo: z.string().min(1).optional(),
})
const corpoStatus = z.object({ status: z.enum(['aprovado', 'rejeitado']) })
const paramsId = z.object({ id: z.string().uuid() })

export async function conhecimentoRotas(app: FastifyInstance) {
  app.get('/conhecimento', async () => listarConhecimento())

  app.post('/conhecimento', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    reply.code(201)
    return criarConhecimento(dados)
  })

  // aprovar / rejeitar (curadoria das sugestões da IA)
  app.post('/conhecimento/:id/status', async (req) => {
    const { id } = paramsId.parse(req.params)
    const { status } = corpoStatus.parse(req.body)
    return definirStatusConhecimento(id, status)
  })

  app.patch('/conhecimento/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    const patch = corpoEditar.parse(req.body)
    return editarConhecimento(id, patch)
  })

  app.delete('/conhecimento/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return excluirConhecimento(id)
  })
}
