// 🖥️ Apresentação — rotas de autenticação.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { autenticarUsuario } from './auth.caso-uso'

const corpoLogin = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
})

export async function authRotas(app: FastifyInstance) {
  // login → devolve o token JWT
  app.post('/auth/login', async (req) => {
    const { email, senha } = corpoLogin.parse(req.body)
    const u = await autenticarUsuario(email, senha)
    const token = await app.jwt.sign(
      { sub: u.id, tenantId: u.tenantId, papel: u.papel, email: u.email },
      { expiresIn: '7d' },
    )
    return {
      token,
      usuario: { id: u.id, email: u.email, papel: u.papel, tenantId: u.tenantId },
    }
  })

  // quem sou eu (a partir do token)
  app.get('/auth/eu', async (req) => ({ usuario: req.user }))
}
