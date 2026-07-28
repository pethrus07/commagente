import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { autenticar } from './core/auth'
import { config } from './core/config'
import { db } from './core/db'
import { seedInicial } from './core/seed'
import { adminRotas } from './features/admin/admin.rotas'
import { agendamentosRotas } from './features/agendamentos/agendamentos.rotas'
import { iniciarAgendador } from './features/agendamentos/agendamentos.worker'
import { authRotas } from './features/auth/auth.rotas'
import { campanhasRotas } from './features/campanhas/campanhas.rotas'
import { conhecimentoRotas } from './features/conhecimento/conhecimento.rotas'
import { contatosRotas } from './features/contatos/contatos.rotas'
import { envioRotas } from './features/envio/envio.rotas'
import { iniciarWorker } from './features/fila/fila.worker'
import { missoesRotas } from './features/missoes/missoes.rotas'
import { numerosRotas } from './features/numeros/numeros.rotas'
import { statsRotas } from './features/stats/stats.rotas'
import { tagsRotas } from './features/tags/tags.rotas'
import { tenantRotas } from './features/tenant/tenant.rotas'
import { webhookRotas } from './features/webhook/webhook.rotas'

const app = Fastify({ logger: true })

// Rede de segurança: nunca deixe uma promise rejeitada/erro solto derrubar o processo
// (o worker roda a cada 3s; um erro transitório não pode tirar o serviço do ar).
process.on('unhandledRejection', (motivo) => app.log.error({ motivo }, 'unhandledRejection'))
process.on('uncaughtException', (err) => app.log.error({ err }, 'uncaughtException'))

// segurança HTTP (produção): cabeçalhos seguros, CORS explícito e rate-limit.
// helmet: cabeçalhos seguros (API JSON — sem CSP de página).
app.register(fastifyHelmet, { contentSecurityPolicy: false })
// CORS: em prod libera só a(s) origem(ns) do painel (CORS_ORIGIN); vazio = libera geral
// (dev usa o proxy do Vite, mesma origem, então não precisa).
app.register(fastifyCors, {
  origin: config.corsOrigin ? config.corsOrigin.split(',').map((o) => o.trim()) : true,
})
// rate-limit: trava abuso/força-bruta. Não conta rotas de saúde (o painel/monitor batem direto).
app.register(fastifyRateLimit, {
  max: 300,
  timeWindow: '1 minute',
  allowList: (req) => req.url === '/health' || req.url === '/ready',
})

// autenticação: JWT + hook global que exige token (menos rotas públicas)
app.register(fastifyJwt, { secret: config.jwtSecret })
app.addHook('onRequest', autenticar)

// erros de validação (zod) viram 400; o resto respeita statusCode ou cai em 500
app.setErrorHandler((err: FastifyError, _req, reply) => {
  if (err instanceof ZodError) {
    reply.code(400)
    return { ok: false, erro: 'validacao', detalhes: err.issues }
  }
  app.log.error(err)
  reply.code(err.statusCode ?? 500)
  return { ok: false, erro: err.message }
})

// liveness — a API está de pé (não depende de nada externo)
app.get('/health', async () => ({ ok: true, servico: 'zapagente-api' }))

// readiness — confirma que o banco responde
app.get('/ready', async (_req, reply) => {
  try {
    await db.$queryRaw`SELECT 1`
    return { ok: true, db: 'up' }
  } catch {
    reply.code(503)
    return { ok: false, db: 'down' }
  }
})

// features
app.register(authRotas)
app.register(adminRotas)
app.register(numerosRotas)
app.register(webhookRotas)
app.register(envioRotas)
app.register(missoesRotas)
app.register(statsRotas)
app.register(contatosRotas)
app.register(conhecimentoRotas)
app.register(campanhasRotas)
app.register(agendamentosRotas)
app.register(tagsRotas)
app.register(tenantRotas)

app
  .listen({ port: config.porta, host: '0.0.0.0' })
  .then(async (addr) => {
    app.log.info(`Commagente API em ${addr}`)
    await seedInicial() // garante tenant padrão + super-admin
    iniciarWorker() // motor anti-bloqueio: consome a fila_envio no ritmo humano
    iniciarAgendador() // missões programadas: dispara o que "vence hoje"
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
