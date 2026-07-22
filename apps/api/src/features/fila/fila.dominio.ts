// 💛 Domínio (puro) — as regras do motor anti-bloqueio (ARQUITETURA-TECNICA §5).

// "HH:mm" → minutos desde a meia-noite
function emMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// a hora atual está dentro da janela de envio? (suporta janela que cruza a meia-noite)
export function dentroDaJanela(
  agoraHHmm: string,
  inicio: string,
  fim: string,
): boolean {
  const a = emMinutos(agoraHHmm)
  const i = emMinutos(inicio)
  const f = emMinutos(fim)
  return i <= f ? a >= i && a <= f : a >= i || a <= f
}

// ainda há budget de envios pro número hoje? (aquecimento)
export function temBudget(enviadosHoje: number, budgetDiario: number): boolean {
  return enviadosHoje < budgetDiario
}

// atraso humano com jitter antes de enviar (evita ritmo de robô)
// 'novo' contato ~6–11s · dentro de 'conversa' ~3–7s
export function jitterMs(tipo: 'novo' | 'conversa'): number {
  return tipo === 'novo'
    ? 6000 + Math.floor(Math.random() * 5000)
    : 3000 + Math.floor(Math.random() * 4000)
}

// ANTI-RAJADA: intervalo mínimo (com jitter) entre DOIS envios do MESMO número.
// Impede que um disparo em lote ou a reabertura da janela mandem tudo de uma vez.
// Abrir contato novo espaça bem mais que responder dentro de uma conversa ativa.
// 'novo' ~45–90s · 'conversa' ~12–30s
export function intervaloEnvioMs(tipo: 'novo' | 'conversa'): number {
  return tipo === 'novo'
    ? 45_000 + Math.floor(Math.random() * 45_000)
    : 12_000 + Math.floor(Math.random() * 18_000)
}
