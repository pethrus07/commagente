// 🖥️ Apresentação — rotas de contatos (leitura p/ o CRM do painel).
import type { FastifyInstance } from 'fastify'
import { listarContatos } from './contatos.caso-uso'

export async function contatosRotas(app: FastifyInstance) {
  app.get('/contatos', async () => listarContatos())
}
