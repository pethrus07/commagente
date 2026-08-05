// 🖥️ Apresentação — rotas de campanhas.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { dnaCamadaSchema } from '../tenant/tenant.dna'
import { estiloSchema } from '../tenant/tenant.estilo'
import {
  adicionarContatosCampanha,
  criarCampanha,
  duplicarCampanha,
  editarCampanha,
  iniciarCampanha,
  listarCampanhas,
  obterCampanha,
  obterRelatorioCampanha,
  relatorioCampanhaCsv,
  sintetizarRelatorioCampanha,
} from './campanhas.caso-uso'

const tipoMissao = z.enum(['vender', 'qualificar', 'orcar', 'cobrar', 'suporte', 'outro'])
const contatos = z
  .array(z.object({ telefone: z.string().min(8), nome: z.string().optional() }))
  .min(1)

// alvo do disparo: contatos avulsos e/ou uma tag (pelo menos um dos dois)
const alvo = { contatos: contatos.optional(), tagId: z.string().uuid().optional() }
const temAlvo = (d: { contatos?: unknown[]; tagId?: string }) =>
  (d.contatos?.length ?? 0) > 0 || !!d.tagId
const msgAlvo = { message: 'Informe ao menos um contato ou uma tag.' }

const corpoCriar = z
  .object({
    nome: z.string().min(1),
    numeroId: z.string().uuid(),
    tipo: tipoMissao.optional(),
    modo: z.enum(['auto', 'copilot']).optional(),
    objetivo: z.string().min(1),
    contexto: z.string().optional(),
    criterioConclusao: z.string().optional(),
    tom: z.string().optional(),
    informacoes: z.string().optional(),
    midiaIds: z.array(z.string().uuid()).optional(), // biblioteca curada (§9 Fase A)
    dna: dnaCamadaSchema.optional(), // camada de DNA da campanha (§9 Fase B)
    estilo: estiloSchema.optional(),
    ...alvo,
  })
  .refine(temAlvo, msgAlvo)

const corpoContatos = z.object(alvo).refine(temAlvo, msgAlvo)
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

  // #9 — ajusta as camadas da campanha (DNA + mídia); reflete vivo nas missões dela
  app.patch('/campanhas/:id', async (req) => {
    const { id } = paramsId.parse(req.params)
    const patch = z
      .object({ dna: dnaCamadaSchema.optional(), midiaIds: z.array(z.string().uuid()).optional() })
      .parse(req.body ?? {})
    return editarCampanha(id, patch)
  })

  // RELATÓRIO consolidado da campanha (conteúdo coletado por contato + placar por estado)
  app.get('/campanhas/:id/relatorio', async (req) => {
    const { id } = paramsId.parse(req.params)
    return obterRelatorioCampanha(id)
  })

  // CONSOLIDAR com IA: relatório gerencial narrativo (sob demanda — custa tokens)
  app.post('/campanhas/:id/relatorio/sintetizar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return sintetizarRelatorioCampanha(id)
  })

  // EXPORTAR o relatório como CSV (download)
  app.get('/campanhas/:id/relatorio/csv', async (req, reply) => {
    const { id } = paramsId.parse(req.params)
    const { nome, csv } = await relatorioCampanhaCsv(id)
    const arquivo = `relatorio-${nome.replace(/[^\w.-]+/g, '_')}.csv`
    reply.header('content-type', 'text/csv; charset=utf-8')
    reply.header('content-disposition', `attachment; filename="${arquivo}"`)
    return '﻿' + csv // BOM p/ o Excel abrir acentos certo
  })

  // adiciona mais contatos a uma campanha em andamento (contatos avulsos e/ou tag)
  app.post('/campanhas/:id/contatos', async (req) => {
    const { id } = paramsId.parse(req.params)
    const alvo = corpoContatos.parse(req.body)
    return adicionarContatosCampanha(id, alvo)
  })

  // DISPARA a campanha: inicia todas as missões ainda paradas ('configurada')
  app.post('/campanhas/:id/iniciar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return iniciarCampanha(id)
  })

  // DUPLICA a definição (sem missões) — base pra teste A/B
  app.post('/campanhas/:id/duplicar', async (req, reply) => {
    const { id } = paramsId.parse(req.params)
    reply.code(201)
    return duplicarCampanha(id)
  })
}
