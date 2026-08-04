// 🧠 Domínio — o DNA do tenant: o conhecimento da empresa organizado em CATEGORIAS nomeadas.
// Renomeia a antiga "Voz da Marca" → DNA. A persona (voz) e o estilo (como escrever) seguem
// separados no schema; o DNA é o CONHECIMENTO — o que a IA sabe e pode afirmar sobre a empresa.
//
// Dois princípios centrais (decisão de arquitetura, o cuidado principal deste item):
//  • defaults-first — categoria vazia simplesmente não existe pro prompt. O cliente preenche
//    só o que importa; nada de 10 formulários obrigatórios em branco.
//  • orçamento de contexto — cada categoria entra no prompt com um TETO (CAP_PROMPT) e há um
//    teto global (CAP_TOTAL). Conteúdo longo (catálogo inteiro etc.) continua indo pra Base de
//    Conhecimento (RAG por relevância), não pro DNA. O DNA é o resumo estruturado sempre-presente.
//
// É a FUNDAÇÃO do DNA hierárquico (Item 9 do parceiro): as MESMAS categorias vão reaparecer no
// contato, na campanha e na missão, com herança (Herdar / Combinar / Substituir).
import { z } from 'zod'

export interface CategoriaDna {
  chave: ChaveDna
  titulo: string
  dica: string // placeholder/ajuda no painel
  prioridade?: boolean // entra como REGRA INVIOLÁVEL (não como conhecimento comum)
}

// Chaves em ordem de exibição no painel e de injeção no prompt.
export const CHAVES_DNA = [
  'empresa',
  'produtos',
  'precos',
  'publicoAlvo',
  'diferenciais',
  'processoComercial',
  'faq',
  'glossario',
  'casosSucesso',
  'regrasNegocio',
] as const
export type ChaveDna = (typeof CHAVES_DNA)[number]
export type Dna = Partial<Record<ChaveDna, string | null>>

export const CATEGORIAS_DNA: CategoriaDna[] = [
  { chave: 'empresa', titulo: 'A empresa', dica: 'Quem é, o que faz, história e missão — em poucas linhas.' },
  { chave: 'produtos', titulo: 'Produtos e serviços', dica: 'O que você vende/oferece. Os principais, não o catálogo inteiro.' },
  { chave: 'precos', titulo: 'Preços e condições', dica: 'Valores, formas de pagamento, prazos. A IA só afirma preço que estiver aqui.' },
  { chave: 'publicoAlvo', titulo: 'Público-alvo', dica: 'Cliente ideal, dores e o que ele valoriza.' },
  { chave: 'diferenciais', titulo: 'Diferenciais', dica: 'Por que escolher você, e não o concorrente.' },
  { chave: 'processoComercial', titulo: 'Processo comercial', dica: 'Como você vende: etapas, abordagem, o que perguntar antes de fechar.' },
  { chave: 'faq', titulo: 'Perguntas e objeções', dica: 'Dúvidas comuns e como respondê-las / contornar objeções.' },
  { chave: 'glossario', titulo: 'Glossário', dica: 'Termos e jargões do seu negócio que a IA precisa entender.' },
  { chave: 'casosSucesso', titulo: 'Casos de sucesso', dica: 'Histórias e argumentos que costumam funcionar.' },
  {
    chave: 'regrasNegocio',
    titulo: 'Regras de negócio',
    dica: 'Limites invioláveis: o que a IA NUNCA pode fazer ou prometer. Prioridade máxima.',
    prioridade: true,
  },
]

// ── Orçamento de contexto ────────────────────────────────────────────────────
const CAP_PROMPT = 1200 // teto por categoria injetada no prompt
const CAP_TOTAL = 6000 // teto do bloco de conhecimento inteiro (soma das categorias)
const MAX_ARMAZENADO = 6000 // teto por categoria no banco (o painel guarda mais do que injeta)

function truncar(txt: string, cap: number): string {
  const t = txt.trim()
  return t.length <= cap ? t : `${t.slice(0, cap).trimEnd()}…`
}

// schema de escrita — todas as categorias opcionais; string generosa (o corte fino é no prompt).
const campo = z.string().trim().max(MAX_ARMAZENADO).nullish()
export const dnaSchema = z.object(
  Object.fromEntries(CHAVES_DNA.map((k) => [k, campo])) as Record<ChaveDna, typeof campo>,
)

// normaliza o JSON do banco → só as categorias realmente preenchidas (defaults-first).
export function lerDna(bruto: unknown): Dna {
  const r = dnaSchema.safeParse(bruto ?? {})
  if (!r.success) return {}
  const out: Dna = {}
  for (const k of CHAVES_DNA) {
    const v = r.data[k]?.trim()
    if (v) out[k] = v
  }
  return out
}

export interface DnaCompilado {
  regras: string | null // Regras de Negócio → vão pro bloco de regras invioláveis (prioridade)
  conhecimento: string | null // demais categorias → fonte de conhecimento autorizada
}

// compila o DNA armazenado no que efetivamente entra no prompt, dentro do orçamento.
export function compilarDna(bruto: unknown): DnaCompilado {
  const d = lerDna(bruto)
  const regras = d.regrasNegocio ? truncar(d.regrasNegocio, CAP_PROMPT) : null

  const partes: string[] = []
  let orcamento = CAP_TOTAL // teto do bloco de conhecimento (rótulos + quebras + conteúdo);
  // as Regras de Negócio são um bloco à parte, limitado só por CAP_PROMPT (prioridade).
  for (const c of CATEGORIAS_DNA) {
    if (c.prioridade) continue // Regras de Negócio saem à parte (bloco de prioridade)
    const v = d[c.chave]
    if (!v || orcamento <= 0) continue
    const rotulo = `• ${c.titulo}: `
    const trecho = truncar(v, Math.max(0, Math.min(CAP_PROMPT, orcamento - rotulo.length)))
    if (!trecho) continue
    partes.push(rotulo + trecho)
    orcamento -= rotulo.length + trecho.length + 1 // +1 pela quebra de linha entre categorias
  }
  return { regras, conhecimento: partes.length ? partes.join('\n') : null }
}
