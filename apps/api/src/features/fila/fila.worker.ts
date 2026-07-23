// ⚙️/🔌 O worker do motor anti-bloqueio: tira da fila e envia no ritmo humano.
import { config } from '../../core/config'
import { enviarDocumento, enviarTexto } from '../envio/envio.caso-uso'
import { dentroDaJanela, intervaloEnvioMs, temBudget, tetoDiarioPorEstagio } from './fila.dominio'
import { filaRepo } from './fila.repo'

type Payload = {
  numeroId: string
  telefone: string
  texto: string
  tipo?: 'novo' | 'conversa'
  // quando presente, envia um documento (ex.: PDF) em vez de texto
  documento?: { base64: string; nomeArquivo: string; mimetype?: string; legenda?: string }
}

// hora atual "HH:mm" no fuso configurado (ex.: America/Sao_Paulo)
function agoraHHmm(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: config.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

// dia atual "YYYY-MM-DD" no fuso configurado (para o reset diário do budget)
function agoraData(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const MAX_TENTATIVAS = 5 // depois disso o item vira dead-letter (status 'erro')

let rodando = false
let inicioTick = 0
const TICK_MAX_MS = 90_000 // watchdog: se um tick passar disso, considera travado e destrava

async function tick() {
  if (rodando) {
    // watchdog anti-freeze: um tick pendurado (rede/Evolution) não pode congelar a fila pra sempre
    if (Date.now() - inicioTick < TICK_MAX_MS) return
    console.error('[fila] watchdog: tick anterior travado >90s, destravando')
  }
  rodando = true
  inicioTick = Date.now()
  try {
    const devidos = await filaRepo.pegarDevidos(new Date())
    for (const item of devidos) {
      const p = item.payload as Payload
      const numero = await filaRepo.buscarNumero(p.numeroId)
      if (!numero) {
        await filaRepo.marcar(item.id, 'erro', true)
        continue
      }
      // reset diário: virou o dia (no TZ) → zera o contador antes de checar o budget
      const hoje = agoraData()
      if (numero.enviadosData !== hoje) {
        await filaRepo.resetarContador(numero.id, hoje)
        numero.enviadosHoje = 0
      }

      // regras anti-bloqueio: fora da janela ou sem budget → deixa pendente (tenta depois)
      if (!dentroDaJanela(agoraHHmm(), numero.janelaInicio, numero.janelaFim)) {
        continue
      }
      // budget efetivo = o menor entre o configurado e o teto do estágio de aquecimento
      const tetoEfetivo = Math.min(
        numero.budgetDiario,
        tetoDiarioPorEstagio(numero.aquecimentoEstagio),
      )
      if (!temBudget(numero.enviadosHoje, tetoEfetivo)) continue

      // OPT-OUT: o contato pediu pra parar → cancela o envio (não retenta)
      if (await filaRepo.contatoOptOut(item.contatoId)) {
        await filaRepo.marcar(item.id, 'erro')
        continue
      }

      // ANTI-RAJADA: respeita o intervalo mínimo entre envios do mesmo número.
      // (o item fica pendente e é reprocessado quando chegar a hora)
      const agora = Date.now()
      if (numero.proximoEnvioEm && agora < numero.proximoEnvioEm.getTime()) {
        continue
      }

      await filaRepo.marcar(item.id, 'enviando')
      try {
        if (p.documento) {
          await enviarDocumento(p.numeroId, p.telefone, p.documento, item.missaoId ?? undefined)
        } else {
          await enviarTexto(p.numeroId, p.telefone, p.texto, item.missaoId ?? undefined)
        }
        await filaRepo.marcar(item.id, 'ok')
        await filaRepo.incrementarEnviados(p.numeroId)
        // agenda o próximo envio permitido deste número (espaça o gotejamento)
        await filaRepo.marcarProximoEnvio(
          p.numeroId,
          new Date(Date.now() + intervaloEnvioMs(p.tipo ?? 'conversa')),
        )
      } catch (err) {
        console.error('[fila] falha ao enviar item', item.id, err)
        // retry com backoff exponencial (30s,60s,120s,240s… cap 10min); depois dead-letter
        if (item.tentativas + 1 < MAX_TENTATIVAS) {
          const backoff = Math.min(600_000, 30_000 * 2 ** item.tentativas)
          await filaRepo.reagendar(item.id, new Date(Date.now() + backoff))
        } else {
          await filaRepo.marcar(item.id, 'erro', true) // esgotou as tentativas
        }
      }
    }
  } finally {
    rodando = false
  }
}

export function iniciarWorker(intervaloMs = 3000) {
  // .catch obrigatório: sem ele, um erro transitório de DB dentro do tick vira
  // unhandled rejection e derruba o processo (Node ≥15). O worker deve ser resiliente.
  setInterval(() => {
    tick().catch((e) => console.error('[fila] tick falhou (ignorado):', e))
  }, intervaloMs)
}
