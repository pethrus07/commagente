// ⚙️/🔌 O worker do motor anti-bloqueio: tira da fila e envia no ritmo humano.
import { config } from '../../core/config'
import { enviarTexto } from '../envio/envio.caso-uso'
import { dentroDaJanela, temBudget } from './fila.dominio'
import { filaRepo } from './fila.repo'

type Payload = { numeroId: string; telefone: string; texto: string }

// hora atual "HH:mm" no fuso configurado (ex.: America/Sao_Paulo)
function agoraHHmm(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: config.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

let rodando = false

async function tick() {
  if (rodando) return // evita sobreposição (o envio simula digitação ~6s)
  rodando = true
  try {
    const devidos = await filaRepo.pegarDevidos(new Date())
    for (const item of devidos) {
      const p = item.payload as Payload
      const numero = await filaRepo.buscarNumero(p.numeroId)
      if (!numero) {
        await filaRepo.marcar(item.id, 'erro', true)
        continue
      }
      // regras anti-bloqueio: fora da janela ou sem budget → deixa pendente (tenta depois)
      if (!dentroDaJanela(agoraHHmm(), numero.janelaInicio, numero.janelaFim)) {
        continue
      }
      if (!temBudget(numero.enviadosHoje, numero.budgetDiario)) continue

      await filaRepo.marcar(item.id, 'enviando')
      try {
        await enviarTexto(p.numeroId, p.telefone, p.texto, item.missaoId ?? undefined)
        await filaRepo.marcar(item.id, 'ok')
        await filaRepo.incrementarEnviados(p.numeroId)
      } catch (err) {
        console.error('[fila] falha ao enviar item', item.id, err)
        await filaRepo.marcar(item.id, 'erro', true)
      }
    }
  } finally {
    rodando = false
  }
}

export function iniciarWorker(intervaloMs = 3000) {
  setInterval(() => void tick(), intervaloMs)
}
