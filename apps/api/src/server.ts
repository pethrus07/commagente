import Fastify, { type FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { config } from './core/config'
import { db } from './core/db'
import { envioRotas } from './features/envio/envio.rotas'
import { iniciarWorker } from './features/fila/fila.worker'
import { missoesRotas } from './features/missoes/missoes.rotas'
import { numerosRotas } from './features/numeros/numeros.rotas'
import { statsRotas } from './features/stats/stats.rotas'
import { webhookRotas } from './features/webhook/webhook.rotas'

const app = Fastify({ logger: true })

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
app.register(numerosRotas)
app.register(webhookRotas)
app.register(envioRotas)
app.register(missoesRotas)
app.register(statsRotas)

app
  .listen({ port: config.porta, host: '0.0.0.0' })
  .then((addr) => {
    app.log.info(`zapagente-api em ${addr}`)
    iniciarWorker() // motor anti-bloqueio: consome a fila_envio no ritmo humano
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
