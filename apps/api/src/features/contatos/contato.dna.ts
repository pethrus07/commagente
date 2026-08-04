// 🧠 Domínio — o DNA do CONTATO: conhecimento estruturado sobre a PESSOA, por categorias.
// Monta sobre o padrão do DNA do tenant (features/tenant/tenant.dna), mas com papel diferente:
// aqui é PERSONALIZAÇÃO (como tratar esta pessoa) — NÃO é fonte de fato autorizado. A IA usa
// pra personalizar a abordagem, mas o guardrail anti-invenção de preço/fato segue valendo.
//
// Mesmos dois cuidados do #4: defaults-first (categoria vazia não entra no prompt) + orçamento
// de contexto (cap por categoria/total). É um degrau rumo ao DNA hierárquico (#9): as categorias
// do contato somam à identidade do tenant sem substituí-la.
import { z } from 'zod'

export interface CategoriaDnaContato {
  chave: ChaveDnaContato
  titulo: string
  dica: string
}

export const CHAVES_DNA_CONTATO = ['perfil', 'comunicacao', 'historico', 'observacoes'] as const
export type ChaveDnaContato = (typeof CHAVES_DNA_CONTATO)[number]
export type DnaContato = Partial<Record<ChaveDnaContato, string | null>>

export const CATEGORIAS_DNA_CONTATO: CategoriaDnaContato[] = [
  { chave: 'perfil', titulo: 'Perfil', dica: 'Quem é: cargo, empresa, papel na decisão, contexto.' },
  { chave: 'comunicacao', titulo: 'Comunicação', dica: 'Como falar com ele: prefere formal ou direto? o que evitar?' },
  { chave: 'historico', titulo: 'Histórico', dica: 'Relacionamento até aqui: compras, promessas, conversas passadas.' },
  { chave: 'observacoes', titulo: 'Observações', dica: 'Notas livres — qualquer coisa útil pra personalizar o atendimento.' },
]

// ── Orçamento de contexto (menor que o do tenant: é sobre UMA pessoa) ──────────
const CAP_PROMPT = 600 // teto por categoria no prompt
const CAP_TOTAL = 1600 // teto do bloco inteiro
const MAX_ARMAZENADO = 4000 // teto por categoria no banco

function truncar(txt: string, cap: number): string {
  const t = txt.trim()
  return t.length <= cap ? t : `${t.slice(0, cap).trimEnd()}…`
}

const campo = z.string().trim().max(MAX_ARMAZENADO).nullish()
export const dnaContatoSchema = z.object(
  Object.fromEntries(CHAVES_DNA_CONTATO.map((k) => [k, campo])) as Record<ChaveDnaContato, typeof campo>,
)

// normaliza o JSON do banco → só as categorias preenchidas (defaults-first).
export function lerDnaContato(bruto: unknown): DnaContato {
  const r = dnaContatoSchema.safeParse(bruto ?? {})
  if (!r.success) return {}
  const out: DnaContato = {}
  for (const k of CHAVES_DNA_CONTATO) {
    const v = r.data[k]?.trim()
    if (v) out[k] = v
  }
  return out
}

// compila o DNA do contato no bloco de personalização que entra no prompt (ou null).
export function compilarDnaContato(bruto: unknown): string | null {
  const d = lerDnaContato(bruto)
  const partes: string[] = []
  let orcamento = CAP_TOTAL
  for (const c of CATEGORIAS_DNA_CONTATO) {
    const v = d[c.chave]
    if (!v || orcamento <= 0) continue
    const rotulo = `• ${c.titulo}: `
    const trecho = truncar(v, Math.max(0, Math.min(CAP_PROMPT, orcamento - rotulo.length)))
    if (!trecho) continue
    partes.push(rotulo + trecho)
    orcamento -= rotulo.length + trecho.length + 1
  }
  return partes.length ? partes.join('\n') : null
}
