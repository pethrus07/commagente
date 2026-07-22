// 🌱 Seed inicial — garante o tenant padrão e o super-admin (login do painel).
import { config } from './config'
import { db } from './db'
import { senha } from './senha'
import { garantirTenantPadrao } from './tenant'

export async function seedInicial() {
  await garantirTenantPadrao() // tenant Celiware (usado pelos casos-de-uso hoje)

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
}
