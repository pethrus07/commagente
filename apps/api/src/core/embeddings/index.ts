// Seleção do provedor de embeddings ativo (provider-agnostic).
// Segue o IA_PROVIDER por padrão (se a IA é OpenAI, os embeddings também),
// mas pode ser fixado via EMBEDDINGS_PROVIDER (openai | duble).
import type { ProvedorEmbeddings } from './porta-embeddings'
import { embeddingsDuble } from './provedor-duble'
import { embeddingsOpenai } from './provedor-openai'

const PROVEDORES: Record<string, ProvedorEmbeddings> = {
  duble: embeddingsDuble,
  openai: embeddingsOpenai,
}

const padrao = process.env.IA_PROVIDER === 'openai' ? 'openai' : 'duble'
const escolhido = process.env.EMBEDDINGS_PROVIDER ?? padrao
export const embeddings: ProvedorEmbeddings =
  PROVEDORES[escolhido] ?? embeddingsDuble
