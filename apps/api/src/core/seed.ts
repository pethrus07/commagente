// 🌱 Seed inicial — garante o tenant padrão e o super-admin (login do painel).
import { config } from './config.js'
import { db } from './db.js'
import { senha } from './senha.js'
import { garantirTenantPadrao } from './tenant.js'

export async function seedInicial() {
  await garantirTenantPadrao() // tenant padrão "PEDRO" (fallback dos casos-de-uso)

  const email = config.superAdmin.email.toLowerCase()
  const existe = await db.usuario.findUnique({ where: { email } })
  if (!existe) {
    await db.usuario.create({
      data: {
        email,
        senhaHash: await senha.hash(config.superAdmin.senha),
        papel: 'super_admin',
        tenantId: null,
      },
    })
    console.log(`[seed] super-admin criado: ${email}`)
  }

  // 1º tenant de exemplo (para a demo e para os testes) + admin próprio.
  // NUNCA em produção: 'demo123' é público (no repo/docs) → seria um login válido semeado.
  const demoEmail = 'demo@zapagente.local'
  const demoExiste =
    process.env.NODE_ENV === 'production'
      ? true // trata como "já existe" → não cria em prod
      : await db.usuario.findUnique({ where: { email: demoEmail } })
  if (!demoExiste) {
    const t = await db.tenant.create({ data: { nome: 'Cliente Demo' } })
    await db.usuario.create({
      data: {
        tenantId: t.id,
        email: demoEmail,
        senhaHash: await senha.hash('demo123'),
        papel: 'admin_tenant',
      },
    })
    console.log(`[seed] tenant "Cliente Demo" criado (login ${demoEmail} / demo123)`)
  }
}
