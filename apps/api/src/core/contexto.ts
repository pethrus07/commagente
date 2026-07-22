// 🧭 Contexto por requisição (multi-tenant): guarda quem está autenticado
// via AsyncLocalStorage, para os casos-de-uso lerem o tenant sem receber por parâmetro.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Papel } from '@prisma/client'
import { ErroHttp } from './erros'
import { garantirTenantPadrao } from './tenant'

export interface CtxRequisicao {
  usuarioId: string
  tenantId: string | null // null = super-admin
  papel: Papel
}

const als = new AsyncLocalStorage<CtxRequisicao>()

export const contexto = {
  // chamado no hook de auth (onRequest) — vale para toda a cadeia async da requisição
  definir(ctx: CtxRequisicao) {
    als.enterWith(ctx)
  },
  atual(): CtxRequisicao | undefined {
    return als.getStore()
  },
}

// Tenant EFETIVO da requisição: o do token. Super-admin sem tenant selecionado
// cai no tenant padrão (ponte até o seletor de tenant do super-admin — MT-4).
export async function tenantAtual(): Promise<string> {
  const c = als.getStore()
  if (c?.tenantId) return c.tenantId
  return garantirTenantPadrao()
}

// Isolamento: garante que o recurso pertence ao tenant da requisição (fecha IDOR).
// 404 (não 403) para não revelar a existência de recursos de outro tenant.
export async function conferirDono(tenantIdDoRecurso: string) {
  if (tenantIdDoRecurso !== (await tenantAtual())) {
    throw new ErroHttp(404, 'Recurso não encontrado')
  }
}
