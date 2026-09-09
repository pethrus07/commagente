// Setup global da suíte E2E: faz login pela API e grava um storageState com o token e o tenant
// já selecionado, para nenhum teste precisar passar pela tela de login. O arquivo gerado fica
// fora do git (.gitignore) porque carrega um token real.
import { request } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Faz login (super-admin) via API e grava um storageState com o token + o tenant
// "PEDRO" selecionado (é o que tem número conectado → habilita missão/campanha).
const API = 'http://localhost:3000'
const ORIGIN = 'http://localhost:5173'

export default async function globalSetup() {
  mkdirSync('.auth', { recursive: true })
  const ctx = await request.newContext({ baseURL: API })

  const res = await ctx.post('/auth/login', {
    data: { email: 'admin@zapagente.local', senha: 'zapagente123' },
  })
  if (!res.ok()) throw new Error(`login super falhou: ${res.status()} ${await res.text()}`)
  const { token, usuario } = await res.json()

  const tRes = await ctx.get('/admin/tenants', { headers: { authorization: `Bearer ${token}` } })
  const tenants = (await tRes.json()) as { id: string; nome: string }[]
  const celi = tenants.find((t) => t.nome === 'PEDRO') ?? tenants[0]

  const localStorage = [
    { name: 'zap_token', value: token },
    { name: 'zap_user', value: JSON.stringify(usuario) },
    { name: 'zap_tenant', value: JSON.stringify({ id: celi.id, nome: celi.nome }) },
  ]
  writeFileSync(
    '.auth/super.json',
    JSON.stringify({ cookies: [], origins: [{ origin: ORIGIN, localStorage }] }),
  )
  await ctx.dispose()
}
