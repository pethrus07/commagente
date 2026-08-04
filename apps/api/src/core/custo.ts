// 💰 Estimativa de custo de IA (gpt-4o-mini). Fonte única de preço — o painel usa os mesmos números.
// US$ 0,15 / 1M tokens de entrada + US$ 0,60 / 1M de saída; câmbio ~5,4.
const USD_ENTRADA = 0.15e-6
const USD_SAIDA = 0.6e-6
const USD_BRL = 5.4

export function custoUsd(entrada: number, saida: number): number {
  return entrada * USD_ENTRADA + saida * USD_SAIDA
}

export function custoBrl(entrada: number, saida: number): number {
  return custoUsd(entrada, saida) * USD_BRL
}

// Teto de alerta por tenant (acumulado). Acima disso, o vigia do super-admin acende o alerta —
// protege a key única/compartilhada da OpenAI contra gasto disparado. [parceiro Fase 1 · pneu]
export const TETO_CUSTO_BRL = Number(process.env.CUSTO_ALERTA_BRL) || 50
