import { db } from './db'

// Dev single-tenant: garante um tenant padrão e devolve o id.
// (Multi-tenant real com UI chega na F3; até lá tudo roda sob este tenant.)
const NOME_PADRAO = 'Celiware'

export async function garantirTenantPadrao(): Promise<string> {
  const existente = await db.tenant.findFirst({ where: { nome: NOME_PADRAO } })
  if (existente) return existente.id
  const novo = await db.tenant.create({ data: { nome: NOME_PADRAO } })
  return novo.id
}
