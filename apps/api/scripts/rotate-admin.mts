// One-off: rotaciona a senha do super-admin (e opcionalmente do demo) no banco.
// Uso: NEW_ADMIN_PW='...' [NEW_DEMO_PW='...'] npx tsx scripts/rotate-admin.mts
import { db } from '../src/core/db'
import { senha } from '../src/core/senha'

const adminPw = process.env.NEW_ADMIN_PW
const demoPw = process.env.NEW_DEMO_PW
if (!adminPw || adminPw.length < 10) {
  console.error('NEW_ADMIN_PW ausente ou curta (>=10).')
  process.exit(1)
}
const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@zapagente.local').toLowerCase()

const a = await db.usuario.updateMany({
  where: { email: adminEmail, papel: 'super_admin' },
  data: { senhaHash: await senha.hash(adminPw) },
})
console.log(`super-admin (${adminEmail}) rotacionado: ${a.count} linha(s)`)

if (demoPw && demoPw.length >= 8) {
  const d = await db.usuario.updateMany({
    where: { email: 'demo@zapagente.local' },
    data: { senhaHash: await senha.hash(demoPw) },
  })
  console.log(`demo rotacionado: ${d.count} linha(s)`)
}
process.exit(0)
