// 💛/🔌 A PORTA da camada de embeddings (provider-agnostic) — vetoriza texto p/ RAG.
// O domínio/aplicação falam só com esta porta; trocar OpenAI↔local↔dublê = trocar o adapter.

export interface ProvedorEmbeddings {
  readonly nome: string
  /** true quando os vetores são semânticos de verdade (só então a busca por relevância vale). */
  readonly semantico: boolean
  /** vetoriza N textos de uma vez (retorna um vetor por texto, na mesma ordem). */
  gerar(textos: string[]): Promise<number[][]>
}

// Similaridade de cosseno entre dois vetores (−1..1; quanto maior, mais parecido).
// Base da recuperação por relevância — puro, sem dependência de infra.
export function similaridadeCosseno(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
