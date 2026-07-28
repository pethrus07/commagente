// ⚙️ Aplicação — configuração do tenant ATUAL (identidade/persona + estilo de conversa da IA).
// A persona é a voz da marca; o estilo são os controles estruturados de COMO ESCREVER.
// Ambos entram SEMPRE no prompt de toda missão (o `tom` da missão dá nuance pontual).
// Escopo = tenant efetivo da requisição (admin edita o seu; super-admin impersonando edita o alvo).
import type { Prisma } from '@prisma/client'
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ESTILO_PADRAO, estiloSchema, lerEstilo, type EstiloConversa } from './tenant.estilo'

const selecao = { id: true, nome: true, persona: true, estilo: true } as const
type LinhaTenant = { id: string; nome: string; persona: string | null; estilo: unknown }

export interface ConfigTenant {
  id: string
  nome: string
  persona: string | null
  estilo: EstiloConversa // sempre completo (normalizado)
}

function mapear(t: LinhaTenant | null, id: string): ConfigTenant {
  if (!t) return { id, nome: '', persona: null, estilo: ESTILO_PADRAO }
  return { id: t.id, nome: t.nome, persona: t.persona, estilo: lerEstilo(t.estilo) }
}

export async function obterConfigTenant(): Promise<ConfigTenant> {
  const id = await tenantAtual()
  const t = await db.tenant.findUnique({ where: { id }, select: selecao })
  return mapear(t, id)
}

export async function definirPersona(persona: string | null): Promise<ConfigTenant> {
  const id = await tenantAtual()
  const valor = persona?.trim() ? persona.trim() : null // vazio → limpa (volta ao padrão)
  const t = await db.tenant.update({ where: { id }, data: { persona: valor }, select: selecao })
  return mapear(t, id)
}

export async function definirEstilo(estilo: EstiloConversa): Promise<ConfigTenant> {
  const id = await tenantAtual()
  const valor = estiloSchema.parse(estilo) // normaliza/valida antes de persistir
  const t = await db.tenant.update({
    where: { id },
    data: { estilo: valor as unknown as Prisma.InputJsonValue },
    select: selecao,
  })
  return mapear(t, id)
}
