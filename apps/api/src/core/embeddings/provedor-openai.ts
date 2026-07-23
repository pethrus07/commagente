// 🔌 Embeddings reais — OpenAI (endpoint /v1/embeddings).
// Usa a mesma OPENAI_API_KEY da IA; troca via EMBEDDINGS_PROVIDER=openai.
import { config } from '../config'
import type { ProvedorEmbeddings } from './porta-embeddings'

export const embeddingsOpenai: ProvedorEmbeddings = {
  nome: 'openai',
  semantico: true,

  async gerar(textos: string[]): Promise<number[][]> {
    if (textos.length === 0) return []
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({ model: config.embeddingsModelo, input: textos }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      throw new Error(
        `OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`,
      )
    }
    const j = (await res.json()) as {
      data?: { index: number; embedding: number[] }[]
    }
    // devolve na ordem de entrada (a API pode não garantir ordem → ordena por index)
    const ordenado = (j.data ?? []).slice().sort((x, y) => x.index - y.index)
    return ordenado.map((d) => d.embedding)
  },
}
