// Seleção do transcritor ativo (provider-agnostic).
// Segue o IA_PROVIDER por padrão (se a IA é OpenAI, a transcrição também),
// mas pode ser fixado via TRANSCRITOR_PROVIDER (openai | duble).
import type { TranscritorAudio } from './porta-transcricao.js'
import { transcritorDuble } from './provedor-duble.js'
import { transcritorOpenai } from './provedor-openai.js'

const TRANSCRITORES: Record<string, TranscritorAudio> = {
  duble: transcritorDuble,
  openai: transcritorOpenai,
}

const padrao = process.env.IA_PROVIDER === 'openai' ? 'openai' : 'duble'
const escolhido = process.env.TRANSCRITOR_PROVIDER ?? padrao
export const transcritor: TranscritorAudio =
  TRANSCRITORES[escolhido] ?? transcritorDuble
