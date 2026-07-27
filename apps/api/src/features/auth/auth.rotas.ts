// 🖥️ Apresentação — rotas de autenticação.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../core/db'
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
      usuario: {
        id: u.id,
        email: u.email,
        papel: u.papel,
        tenantId: u.tenantId,
        aceitouTermos: !!u.aceitouTermosEm, // pro painel decidir se mostra os termos
      },
    }
  })

  // quem sou eu (a partir do token)
  app.get('/auth/eu', async (req) => ({ usuario: req.user }))

  // registra o aceite dos termos (LGPD/uso de dados + responsabilidade do número)
  app.post('/auth/aceitar-termos', async (req) => {
    const sub = (req.user as { sub: string }).sub
    await db.usuario.update({ where: { id: sub }, data: { aceitouTermosEm: new Date() } })
    return { ok: true, aceitouTermos: true }
  })
}
