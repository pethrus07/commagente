import Fastify from 'fastify'
import { config } from './core/config'
import { db } from './core/db'

const app = Fastify({ logger: true })

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

app
  .listen({ port: config.porta, host: '0.0.0.0' })
  .then((addr) => app.log.info(`zapagente-api em ${addr}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
