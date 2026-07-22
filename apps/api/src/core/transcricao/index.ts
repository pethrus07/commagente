// Seleção do transcritor ativo (provider-agnostic).
// Segue o IA_PROVIDER por padrão (se a IA é OpenAI, a transcrição também),
// mas pode ser fixado via TRANSCRITOR_PROVIDER (openai | duble).
import type { TranscritorAudio } from './porta-transcricao'
import { transcritorDuble } from './provedor-duble'
import { transcritorOpenai } from './provedor-openai'

const TRANSCRITORES: Record<string, TranscritorAudio> = {
  duble: transcritorDuble,
  openai: transcritorOpenai,
}

const padrao = process.env.IA_PROVIDER === 'openai' ? 'openai' : 'duble'
const escolhido = process.env.TRANSCRITOR_PROVIDER ?? padrao
export const transcritor: TranscritorAudio =
  TRANSCRITORES[escolhido] ?? transcritorDuble
