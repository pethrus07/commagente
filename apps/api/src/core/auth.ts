// 🔐 Autenticação — payload do JWT + hook global que protege as rotas.
import type { Papel } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { contexto } from './contexto.js'

export interface TokenUsuario {
  sub: string // id do usuário
  tenantId: string | null // null = super-admin (sem tenant)
  papel: Papel
  email: string
}

// tipa req.user (populado por req.jwtVerify)
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenUsuario
    user: TokenUsuario
  }
}

// rotas liberadas (sem token). O webhook tem proteção PRÓPRIA (segredo no caminho).
const PUBLICAS = new Set(['/health', '/ready', '/auth/login'])

// onRequest global (callback-style): valida o JWT e envolve o resto do ciclo da
// requisição no contexto de tenant (als.run(store, done)) — só assim o AsyncLocalStorage
// propaga do hook até o handler. Rotas públicas passam direto.
export function autenticar(
  req: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
) {
  const rota = req.routeOptions?.url ?? req.url.split('?')[0]
  // /webhook e /webhook/:segredo passam sem token (a validação do segredo é na própria rota)
  if (PUBLICAS.has(rota) || rota.startsWith('/webhook')) return done()

  req
    .jwtVerify()
    .then(() => {
      // super-admin pode "operar como" um tenant via header x-tenant-id (seletor do painel)
      let tenantId = req.user.tenantId
      if (req.user.papel === 'super_admin') {
        const sel = req.headers['x-tenant-id']
        if (typeof sel === 'string' && sel) tenantId = sel
      }
      contexto.run(
        { usuarioId: req.user.sub, tenantId, papel: req.user.papel },
        done,
      )
    })
    .catch(() => reply.code(401).send({ ok: false, erro: 'nao_autenticado' }))
}

// exige um papel específico (ex.: super-admin nas rotas /admin)
export function exigirPapel(...papeis: Papel[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!papeis.includes(req.user.papel)) {
      return reply.code(403).send({ ok: false, erro: 'sem_permissao' })
    }
  }
}
