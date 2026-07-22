// 🖥️ Apresentação — rotas HTTP de conexão de número.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  atualizarConfigNumero,
  cadastrarNumero,
  conectarNumero,
  listarNumeros,
  statusNumero,
} from './numeros.caso-uso'

const corpoCadastro = z.object({
  telefone: z.string().min(8),
  instancia: z.string().min(1).optional(),
})

const corpoConfig = z.object({
  janelaInicio: z.string().optional(),
  janelaFim: z.string().optional(),
  budgetDiario: z.number().int().optional(),
  maxConversasAtivas: z.number().int().optional(),
})

const paramsId = z.object({ id: z.string().uuid() })

export async function numerosRotas(app: FastifyInstance) {
  // lista os números do tenant
  app.get('/numeros', async () => listarNumeros())

  // cadastra um número (chip) que depois será conectado
  app.post('/numeros', async (req, reply) => {
    const { telefone, instancia } = corpoCadastro.parse(req.body)
    const numero = await cadastrarNumero(telefone, instancia)
    reply.code(201)
    return {
      id: numero.id,
      telefone: numero.telefone,
      instancia: numero.instanciaEvolution,
    }
  })

  // edita os knobs anti-bloqueio (janela, budget diário, cap de conversas ativas)
  app.patch('/numeros/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    const patch = corpoConfig.parse(req.body)
    return atualizarConfigNumero(id, patch)
  })

  // inicia a conexão → devolve o QR pra escanear no celular
  app.post('/numeros/:id/conectar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return conectarNumero(id)
  })

  // estado atual da sessão (desconectado | conectando | conectado)
  app.get('/numeros/:id/status', async (req) => {
    const { id } = paramsId.parse(req.params)
    return statusNumero(id)
  })
}
