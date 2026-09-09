// Seleção do provedor de IA ativo (provider-agnostic), por IA_PROVIDER.
// Dois hoje: openai (produção) e duble (offline, determinístico, sem key nem custo — é assim
// que o E2E roda e que se desenvolve sem queimar token). O harness não sabe qual está ativo.
// Valor desconhecido cai no dublê de propósito: melhor rodar burro do que não subir.
import type { ProvedorIA } from './porta-ia'
import { provedorDuble } from './provedor-duble'
import { provedorOpenai } from './provedor-openai'

const PROVEDORES: Record<string, ProvedorIA> = {
  duble: provedorDuble,
  openai: provedorOpenai,
}

const escolhido = process.env.IA_PROVIDER ?? 'duble'
export const ia: ProvedorIA = PROVEDORES[escolhido] ?? provedorDuble
