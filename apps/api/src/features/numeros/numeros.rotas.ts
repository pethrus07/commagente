// 🖥️ Apresentação — rotas HTTP de conexão de número.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  cadastrarNumero,
  conectarNumero,
  statusNumero,
} from './numeros.caso-uso'

const corpoCadastro = z.object({
  telefone: z.string().min(8),
  instancia: z.string().min(1).optional(),
})

const paramsId = z.object({ id: z.string().uuid() })

export async function numerosRotas(app: FastifyInstance) {
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
