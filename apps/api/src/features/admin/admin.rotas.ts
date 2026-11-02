// 🖥️ Apresentação — rotas de administração da plataforma (super-admin).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirPapel } from '../../core/auth.js'
import { criarTenant, listarTenants } from './admin.caso-uso.js'

const corpoTenant = z.object({
  nome: z.string().min(1),
  adminEmail: z.string().email(),
  adminSenha: z.string().min(6),
})

export async function adminRotas(app: FastifyInstance) {
  // trava toda a área /admin para super-admin
  const soSuperAdmin = { preHandler: exigirPapel('super_admin') }

  app.get('/admin/tenants', soSuperAdmin, async () => listarTenants())

  app.post('/admin/tenants', soSuperAdmin, async (req, reply) => {
    const dados = corpoTenant.parse(req.body)
    const t = await criarTenant(dados)
    reply.code(201)
    return t
  })
}
