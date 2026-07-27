// ⚙️ Aplicação — configuração do tenant ATUAL (identidade/persona da IA).
// A persona é a voz da marca: definida uma vez, entra SEMPRE no prompt de toda missão
// (o `tom` de cada missão dá nuance/override). Escopo = tenant efetivo da requisição
// (o admin do tenant edita o seu; super-admin impersonando edita o do tenant selecionado).
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'

const selecao = { id: true, nome: true, persona: true } as const

export async function obterConfigTenant() {
  const id = await tenantAtual()
  const t = await db.tenant.findUnique({ where: { id }, select: selecao })
  return t ?? { id, nome: '', persona: null }
}

export async function definirPersona(persona: string | null) {
  const id = await tenantAtual()
  const valor = persona?.trim() ? persona.trim() : null // vazio → limpa (volta ao padrão)
  return db.tenant.update({ where: { id }, data: { persona: valor }, select: selecao })
}
