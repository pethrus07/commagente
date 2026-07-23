// 🖥️ Apresentação — rotas de tags (segmentação de contatos).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  aplicarTag,
  aplicarTagEmLote,
  criarTag,
  listarTags,
  removerTag,
  removerTagDoContato,
} from './tags.caso-uso'

const corpoCriar = z.object({
  nome: z.string().min(1),
  cor: z.string().optional(),
})
const corpoLote = z.object({ contatoIds: z.array(z.string().uuid()).min(1) })

export async function tagsRotas(app: FastifyInstance) {
  app.get('/tags', async () => listarTags())

  app.post('/tags', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    reply.code(201)
    return criarTag(dados)
  })

  app.delete('/tags/:id', async (req) => {
    const { id } = req.params as { id: string }
    return removerTag(id)
  })

  // aplica uma tag a vários contatos de uma vez
  app.post('/tags/:id/contatos', async (req) => {
    const { id } = req.params as { id: string }
    const { contatoIds } = corpoLote.parse(req.body)
    return aplicarTagEmLote(id, contatoIds)
  })

  // liga/desliga uma tag num contato
  app.post('/contatos/:id/tags', async (req) => {
    const { id } = req.params as { id: string }
    const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body)
    return aplicarTag(id, tagId)
  })

  app.delete('/contatos/:id/tags/:tagId', async (req) => {
    const { id, tagId } = req.params as { id: string; tagId: string }
    return removerTagDoContato(id, tagId)
  })
}
