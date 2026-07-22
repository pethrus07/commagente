// 💛 Domínio (puro) — saúde do número (anti-ban / gatilho 2026 de não-respondidas).

export type StatusSaude = 'saudavel' | 'atencao' | 'risco' | 'amostra_baixa'

export interface SaudeNumero {
  base: number // missões iniciadas há +48h (tiveram tempo de responder), últimos 30d
  respondidas: number
  naoRespondidas: number
  replyRate: number | null // 0..1
  status: StatusSaude
}

const AMOSTRA_MIN = 10 // abaixo disso, dados insuficientes p/ decidir
const LIMITE_RISCO = 0.15 // < 15% de resposta → throttle (zona de perigo do mercado)
const LIMITE_ATENCAO = 0.3 // < 30% → aviso

// Classifica a saúde a partir de dois contadores simples (base e não-respondidas).
export function classificarSaude(base: number, naoRespondidas: number): SaudeNumero {
  const respondidas = Math.max(0, base - naoRespondidas)
  const replyRate = base > 0 ? respondidas / base : null
  let status: StatusSaude
  if (base < AMOSTRA_MIN) status = 'amostra_baixa'
  else if (replyRate! >= LIMITE_ATENCAO) status = 'saudavel'
  else if (replyRate! >= LIMITE_RISCO) status = 'atencao'
  else status = 'risco'
  return { base, respondidas, naoRespondidas, replyRate, status }
}
