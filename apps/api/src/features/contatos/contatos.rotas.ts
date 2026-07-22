// 🖥️ Apresentação — rotas de contatos (CRM): listar, criar, importar, exportar.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  criarContato,
  exportarContatosCSV,
  importarContatos,
  importarDoWhatsApp,
  listarContatos,
} from './contatos.caso-uso'

const corpoCriar = z.object({
  nome: z.string().optional(),
  telefone: z.string().min(8),
})

const corpoImportar = z.object({
  contatos: z
    .array(z.object({ nome: z.string().optional(), telefone: z.string().min(1) }))
    .min(1),
})

const corpoImportarWa = z.object({ numeroId: z.string().uuid() })

export async function contatosRotas(app: FastifyInstance) {
  app.get('/contatos', async () => listarContatos())

  app.post('/contatos', async (req, reply) => {
    const dados = corpoCriar.parse(req.body)
    reply.code(201)
    return criarContato(dados)
  })

  // importar de planilha/outros sistemas (linhas já parseadas no painel)
  app.post('/contatos/importar', async (req) => {
    const { contatos } = corpoImportar.parse(req.body)
    return importarContatos(contatos)
  })

  // importar a agenda do número conectado (via Evolution)
  app.post('/contatos/importar-whatsapp', async (req) => {
    const { numeroId } = corpoImportarWa.parse(req.body)
    return importarDoWhatsApp(numeroId)
  })

  // exportar a base em CSV (download)
  app.get('/contatos/exportar', async (_req, reply) => {
    const csv = await exportarContatosCSV()
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="contatos.csv"')
    return csv
  })
}
