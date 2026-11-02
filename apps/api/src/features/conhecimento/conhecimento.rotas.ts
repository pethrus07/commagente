// 🖥️ Apresentação — rotas da base de conhecimento (memória coletiva).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CHAVES_DNA } from '../tenant/tenant.dna.js'
import {
  criarConhecimento,
  definirStatusConhecimento,
  editarConhecimento,
  excluirConhecimento,
  importarDocumento,
  importarUrl,
  listarConhecimento,
} from './conhecimento.caso-uso.js'

// só uma chave conhecida do DNA (empresa/produtos/...) ou null = base geral — evita doc órfão no painel
const categoria = z.enum([...CHAVES_DNA] as [string, ...string[]]).nullish()
const corpoCriar = z.object({
  titulo: z.string().min(1),
  conteudo: z.string().min(1),
  categoria,
})
const corpoDoc = z.object({
  nomeArquivo: z.string().min(1),
  mimetype: z.string().default('application/octet-stream'),
  base64: z.string().min(1),
  categoria,
})
const corpoEditar = z.object({
  titulo: z.string().min(1).optional(),
  conteudo: z.string().min(1).optional(),
  categoria,
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

  // ingestão de documento (PDF/DOCX/TXT em base64) → vira entrada de Conhecimento.
  // bodyLimit maior: o base64 do arquivo passa do limite padrão de 1MB.
  app.post(
    '/conhecimento/importar-documento',
    { bodyLimit: 25 * 1024 * 1024 },
    async (req, reply) => {
      const dados = corpoDoc.parse(req.body)
      reply.code(201)
      return importarDocumento(dados)
    },
  )

  // aprendizado por link (§8.14): cola a URL → busca, extrai o texto e vira conhecimento.
  app.post('/conhecimento/importar-url', async (req, reply) => {
    const dados = z.object({ url: z.string().url(), categoria }).parse(req.body)
    reply.code(201)
    return importarUrl(dados)
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
