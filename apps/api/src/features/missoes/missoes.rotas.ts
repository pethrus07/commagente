// 🖥️ Apresentação — rotas HTTP de missão.
import { EstadoMissao } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  assumirConversa,
  criarMissao,
  devolverParaIa,
  editarMissao,
  iniciarMissao,
  listarEscalados,
  listarMissoes,
  mudarEstado,
  obterMissao,
} from './missoes.caso-uso'

const corpoCriar = z.object({
  telefone: z.string().min(8),
  numeroId: z.string().uuid(),
  objetivo: z.string().min(1),
  contexto: z.string().optional(),
  tom: z.string().optional(),
  informacoes: z.string().optional(),
  nomeContato: z.string().optional(),
})

// PATCH: todos opcionais; string vazia é permitida (limpa o campo → null no caso-uso).
const corpoEditar = z.object({
  objetivo: z.string().min(1).optional(),
  contexto: z.string().nullish(),
  tom: z.string().nullish(),
  informacoes: z.string().nullish(),
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

  // inbox de escalados (missões aguardando um humano)
  app.get('/escalados', async () => listarEscalados())

  app.get('/missoes/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return obterMissao(id)
  })

  // edita a config da missão (objetivo/contexto/tom/informações/nome)
  app.patch('/missoes/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    const patch = corpoEditar.parse(req.body)
    return editarMissao(id, patch)
  })

  // muda o estado (validado pela máquina de estados; 409 se inválido)
  app.post('/missoes/:id/estado', async (req) => {
    const { id } = paramsId.parse(req.params)
    const { estado } = corpoEstado.parse(req.body)
    return mudarEstado(id, estado)
  })

  // Modo A — inicia a missão: a IA manda a 1ª mensagem
  app.post('/missoes/:id/iniciar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return iniciarMissao(id)
  })

  // Escalada humana — humano assume (IA pausa) / devolve pra IA (IA volta)
  app.post('/missoes/:id/assumir', async (req) => {
    const { id } = paramsId.parse(req.params)
    return assumirConversa(id)
  })
  app.post('/missoes/:id/devolver-ia', async (req) => {
    const { id } = paramsId.parse(req.params)
    return devolverParaIa(id)
  })
}
