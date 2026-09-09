// Tenant PADRÃO — a ponte do super-admin, não o modo de operação.
// O multi-tenant real existe e está em core/contexto.ts (token + header x-tenant-id). Este
// arquivo cobre o único buraco que sobrou: quem chega SEM tenant no token e SEM tenant
// selecionado (o super-admin recém-logado) precisa cair em algum lugar em vez de estourar.
// Também é o tenant que o seed garante no boot. Ver docs/ARQUITETURA.md §16.9.
import { db } from './db'

const NOME_PADRAO = 'PEDRO'

export async function garantirTenantPadrao(): Promise<string> {
  const existente = await db.tenant.findFirst({ where: { nome: NOME_PADRAO } })
  if (existente) return existente.id
  const novo = await db.tenant.create({ data: { nome: NOME_PADRAO } })
  return novo.id
}
