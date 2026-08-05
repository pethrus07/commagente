// 🖥️ Apresentação — rotas HTTP de missão.
import { EstadoMissao } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { dnaCamadaSchema } from '../tenant/tenant.dna'
import { estiloSchema } from '../tenant/tenant.estilo'
import { aprovarRascunho, descartarRascunho } from '../conversa/conversa.caso-uso'
import {
  assumirConversa,
  criarMissao,
  criarMissaoEmLote,
  devolverParaIa,
  editarMissao,
  iniciarMissao,
  iniciarMissoesConfiguradas,
  listarEscalados,
  listarMissoes,
  mudarEstado,
  obterMissao,
} from './missoes.caso-uso'

const tipoMissao = z.enum(['vender', 'qualificar', 'orcar', 'cobrar', 'suporte', 'outro'])
const modoMissao = z.enum(['auto', 'copilot'])
const midiaIds = z.array(z.string().uuid()).optional() // biblioteca curada (§9 Fase A)
const dnaCamada = dnaCamadaSchema.optional() // camada de DNA da missão (§9 Fase C)

const corpoCriar = z.object({
  telefone: z.string().min(8),
  numeroId: z.string().uuid(),
  tipo: tipoMissao.optional(),
  modo: modoMissao.optional(),
  objetivo: z.string().min(1),
  contexto: z.string().optional(),
  criterioConclusao: z.string().optional(),
  tom: z.string().optional(),
  informacoes: z.string().optional(),
  midiaIds,
  dna: dnaCamada,
  estilo: estiloSchema.optional(),
  nomeContato: z.string().optional(),
})

// PATCH: todos opcionais; string vazia é permitida (limpa o campo → null no caso-uso).
const corpoEditar = z.object({
  tipo: tipoMissao.optional(),
  modo: modoMissao.optional(),
  objetivo: z.string().min(1).optional(),
  contexto: z.string().nullish(),
  criterioConclusao: z.string().nullish(),
  tom: z.string().nullish(),
  informacoes: z.string().nullish(),
  dna: dnaCamada,
  nomeContato: z.string().optional(),
})

// disparo em lote: a mesma missão → vários contatos (avulsos e/ou todos de uma tag)
const corpoLote = z
  .object({
    numeroId: z.string().uuid(),
    tipo: tipoMissao.optional(),
    modo: modoMissao.optional(),
    objetivo: z.string().min(1),
    contexto: z.string().optional(),
    criterioConclusao: z.string().optional(),
    tom: z.string().optional(),
    informacoes: z.string().optional(),
    midiaIds,
    dna: dnaCamada,
    estilo: estiloSchema.optional(),
    contatos: z
      .array(z.object({ telefone: z.string().min(8), nome: z.string().optional() }))
      .min(1)
      .optional(),
    tagId: z.string().uuid().optional(),
  })
  .refine((d) => (d.contatos?.length ?? 0) > 0 || !!d.tagId, {
    message: 'Informe ao menos um contato ou uma tag.',
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

  // disparo em lote: cria N missões (uma por contato) com a mesma definição
  app.post('/missoes/lote', async (req, reply) => {
    const dados = corpoLote.parse(req.body)
    const r = await criarMissaoEmLote(dados)
    reply.code(201)
    return r
  })

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

  // Início em LOTE — dispara várias missões 'configurada' de uma vez (relatório do que
  // iniciou/pulou); usado pelo "Iniciar todas" do board e reaproveitado pela campanha.
  app.post('/missoes/iniciar-lote', async (req) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body)
    return iniciarMissoesConfiguradas(ids)
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

  // Co-pilot: aprovar (opcionalmente editado) ou descartar o rascunho da IA
  app.post('/missoes/:id/rascunho/aprovar', async (req) => {
    const { id } = paramsId.parse(req.params)
    const { texto } = z.object({ texto: z.string().optional() }).parse(req.body ?? {})
    return aprovarRascunho(id, texto)
  })
  app.post('/missoes/:id/rascunho/descartar', async (req) => {
    const { id } = paramsId.parse(req.params)
    return descartarRascunho(id)
  })
}
