// 🎭 Embeddings DUBLÊ (offline, determinístico) — bag-of-words com hash em dim fixa.
// NÃO é semântico (semantico=false) → a recuperação por relevância cai no fallback
// "todo o conhecimento aprovado". Serve só p/ o código não quebrar sem OpenAI.
import type { ProvedorEmbeddings } from './porta-embeddings.js'

const DIM = 64

function hash(token: string): number {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % DIM
}

export const embeddingsDuble: ProvedorEmbeddings = {
  nome: 'duble',
  semantico: false,

  async gerar(textos: string[]): Promise<number[][]> {
    return textos.map((t) => {
      const v = new Array(DIM).fill(0)
      for (const tok of t.toLowerCase().split(/\W+/).filter(Boolean)) {
        v[hash(tok)] += 1
      }
      return v
    })
  },
}
