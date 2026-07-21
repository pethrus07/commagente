// Seleção do provedor de IA ativo (provider-agnostic).
// Hoje só o dublê; a Fatia 4b/produção pluga o OpenAI aqui (por env), sem tocar no harness.
import type { ProvedorIA } from './porta-ia'
import { provedorDuble } from './provedor-duble'
import { provedorOpenai } from './provedor-openai'

const PROVEDORES: Record<string, ProvedorIA> = {
  duble: provedorDuble,
  openai: provedorOpenai,
}

const escolhido = process.env.IA_PROVIDER ?? 'duble'
export const ia: ProvedorIA = PROVEDORES[escolhido] ?? provedorDuble
