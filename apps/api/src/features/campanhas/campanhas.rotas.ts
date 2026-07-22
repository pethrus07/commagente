// 🖥️ Apresentação — rotas de campanhas.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  adicionarContatosCampanha,
  criarCampanha,
  listarCampanhas,
  obterCampanha,
} from './campanhas.caso-uso'

const tipoMissao = z.enum(['vender', 'qualificar', 'orcar', 'cobrar', 'suporte', 'outro'])
const contatos = z
  .array(z.object({ telefone: z.string().min(8), nome: z.string().optional() }))
  .min(1)

const corpoCriar = z.object({
  nome: z.string().min(1),
  numeroId: z.string().uuid(),
  tipo: tipoMissao.optional(),
  objetivo: z.string().min(1),
  contexto: z.string().optional(),
  criterioConclusao: z.string().optional(),
  tom: z.string().optional(),
  informacoes: z.string().optional(),
  contatos,
})

const corpoContatos = z.object({ contatos })
const paramsId = z.object({ id: z.string().uuid() })

export async function campanhasRotas(app: FastifyInstance) {
  app.get('/campanhas', async () => listarCampanhas())

  app.post('/campanhas', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    reply.code(201)
    return criarCampanha(dados)
  })

  app.get('/campanhas/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return obterCampanha(id)
  })

  // adiciona mais contatos a uma campanha em andamento
  app.post('/campanhas/:id/contatos', async (req) => {
    const { id } = paramsId.parse(req.params)
    const { contatos } = corpoContatos.parse(req.body)
    return adicionarContatosCampanha(id, contatos)
  })
}
