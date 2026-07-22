// 🖥️ Apresentação — rotas das missões programadas.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  criarAgendamento,
  criarAgendamentosEmLote,
  dispararAgora,
  editarAgendamento,
  listarAgendamentos,
  pularCiclo,
  removerAgendamento,
} from './agendamentos.caso-uso'

const recorrencia = z.enum(['uma_vez', 'mensal'])
const entrega = z.enum(['ia', 'fixa'])

const def = {
  numeroId: z.string().uuid(),
  tipo: z.string().optional(),
  modo: z.enum(['auto', 'copilot']).optional(),
  objetivo: z.string().optional(),
  contexto: z.string().optional(),
  criterioConclusao: z.string().optional(),
  tom: z.string().optional(),
  informacoes: z.string().optional(),
  recorrencia,
  diaDoMes: z.number().int().min(1).max(31).optional(),
  dataUnica: z.string().optional(),
  entrega,
  mensagemFixa: z.string().optional(),
  rotulo: z.string().optional(),
}

const corpoCriar = z.object({ ...def, telefone: z.string().min(8), nomeContato: z.string().optional() })
const corpoLote = z.object({
  ...def,
  contatos: z
    .array(z.object({ telefone: z.string(), nome: z.string().optional(), dia: z.number().int().min(1).max(31).optional() }))
    .min(1),
})
const corpoEditar = z.object({
  diaDoMes: z.number().int().min(1).max(31).optional(),
  ativo: z.boolean().optional(),
  objetivo: z.string().optional(),
  tom: z.string().optional(),
  informacoes: z.string().optional(),
  criterioConclusao: z.string().optional(),
  mensagemFixa: z.string().optional(),
  rotulo: z.string().optional(),
})
const paramsId = z.object({ id: z.string().uuid() })

export async function agendamentosRotas(app: FastifyInstance) {
  app.get('/agendamentos', async () => listarAgendamentos())

  app.post('/agendamentos', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    const ag = await criarAgendamento(dados)
    reply.code(201)
    return ag
  })

  app.post('/agendamentos/lote', async (req, reply) => {
    const dados = corpoLote.parse(req.body)
    const r = await criarAgendamentosEmLote(dados)
    reply.code(201)
    return r
  })

  app.patch('/agendamentos/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return editarAgendamento(id, corpoEditar.parse(req.body))
  })

  app.post('/agendamentos/:id/pular', async (req) => {
    const { id } = paramsId.parse(req.params)
    return pularCiclo(id)
  })

  app.post('/agendamentos/:id/disparar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return dispararAgora(id)
  })

  app.delete('/agendamentos/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    return removerAgendamento(id)
  })
}
