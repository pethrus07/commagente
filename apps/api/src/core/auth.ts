// 🔐 Autenticação — payload do JWT + hook global que protege as rotas.
import type { Papel } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'

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

// rotas liberadas (sem token). O webhook tem proteção própria (segredo) — F futura.
const PUBLICAS = new Set(['/health', '/ready', '/auth/login', '/webhook'])

// onRequest global: exige JWT válido em tudo, menos nas rotas públicas.
export async function autenticar(req: FastifyRequest, reply: FastifyReply) {
  const rota = req.routeOptions?.url ?? req.url.split('?')[0]
  if (PUBLICAS.has(rota)) return
  try {
    await req.jwtVerify()
  } catch {
    return reply.code(401).send({ ok: false, erro: 'nao_autenticado' })
  }
}

// exige um papel específico (ex.: super-admin nas rotas /admin)
export function exigirPapel(...papeis: Papel[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!papeis.includes(req.user.papel)) {
      return reply.code(403).send({ ok: false, erro: 'sem_permissao' })
    }
  }
}
