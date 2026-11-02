// ⚙️ O agendador: verifica periodicamente quais missões programadas "vencem hoje"
// e dispara. Roda a cada 5 min (o disparo em si é idempotente por ciclo).
import { processarDevidos } from './agendamentos.caso-uso.js'

let rodando = false

async function tick() {
  if (rodando) return
  rodando = true
  try {
    await processarDevidos()
  } finally {
    rodando = false
  }
}

export function iniciarAgendador(intervaloMs = 300_000) {
  // dispara logo no boot (pega o que venceu enquanto estava fora do ar) e depois a cada intervalo
  tick().catch((e) => console.error('[agendador] tick inicial falhou:', e))
  setInterval(() => {
    tick().catch((e) => console.error('[agendador] tick falhou (ignorado):', e))
  }, intervaloMs)
}
