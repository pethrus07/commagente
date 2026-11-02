/**
 * 🖥️ Entrada da API. A ORDEM aqui importa: rede de segurança de processo → segurança HTTP
 * (helmet, CORS explícito, rate-limit) → JWT + hook global de autenticação → handler de erro
 * que não vaza internals → /health e /ready → as features → e, só depois de escutar a porta,
 * o seed e os TRÊS workers (fila de envio, agendador de programadas, reconciliador de chips).
 * Os workers vivem NESTE processo, de propósito: um deploy só, e a fila fica transacional
 * com o resto do banco (ver docs/ARQUITETURA.md §1 e §6).
 */
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { autenticar } from './core/auth.js'
import { config } from './core/config.js'
import { db } from './core/db.js'
import { seedInicial } from './core/seed.js'
import { adminRotas } from './features/admin/admin.rotas.js'
import { agendamentosRotas } from './features/agendamentos/agendamentos.rotas.js'
import { iniciarAgendador } from './features/agendamentos/agendamentos.worker.js'
import { authRotas } from './features/auth/auth.rotas.js'
import { campanhasRotas } from './features/campanhas/campanhas.rotas.js'
import { conhecimentoRotas } from './features/conhecimento/conhecimento.rotas.js'
import { contatosRotas } from './features/contatos/contatos.rotas.js'
import { envioRotas } from './features/envio/envio.rotas.js'
import { iniciarWorker } from './features/fila/fila.worker.js'
import { missoesRotas } from './features/missoes/missoes.rotas.js'
import { iniciarReconciliadorNumeros } from './features/numeros/numeros.reconciliador.js'
import { numerosRotas } from './features/numeros/numeros.rotas.js'
import { statsRotas } from './features/stats/stats.rotas.js'
import { tagsRotas } from './features/tags/tags.rotas.js'
import { tenantRotas } from './features/tenant/tenant.rotas.js'
import { midiaRotas } from './features/midia/midia.rotas.js'
import { inteligenciaRotas } from './features/inteligencia/inteligencia.rotas.js'
import { webhookRotas } from './features/webhook/webhook.rotas.js'

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
  const status = err.statusCode ?? 500
  reply.code(status)
  // 4xx intencionais (ErroHttp: "Missão não encontrada" etc.) mostram a mensagem;
  // 5xx/inesperados NÃO vazam internals (Prisma/URLs/SQL) pro cliente — só no log.
  return { ok: false, erro: status >= 500 ? 'erro interno' : err.message }
})

// liveness — a API está de pé (não depende de nada externo)
app.get('/health', async () => ({ ok: true, servico: 'commagente-api' }))

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
app.register(midiaRotas)
app.register(inteligenciaRotas)

app
  .listen({ port: config.porta, host: '0.0.0.0' })
  .then(async (addr) => {
    app.log.info(`Commagente API em ${addr}`)
    await seedInicial() // garante tenant padrão + super-admin
    iniciarWorker() // motor anti-bloqueio: consome a fila_envio no ritmo humano
    iniciarAgendador() // missões programadas: dispara o que "vence hoje"
    iniciarReconciliadorNumeros() // backstop: detecta chip caído (status real da Evolution)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
