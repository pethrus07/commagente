// ⚙️/🔌 O worker do motor anti-bloqueio: tira da fila e envia no ritmo humano.
import { config } from '../../core/config.js'
import { enviarDocumento, enviarTexto } from '../envio/envio.caso-uso.js'
import { dentroDaJanela, intervaloEnvioMs, temBudget, tetoDiarioPorEstagio } from './fila.dominio.js'
import { filaRepo } from './fila.repo.js'

type Payload = {
  numeroId: string
  telefone: string
  texto: string
  tipo?: 'novo' | 'conversa'
  // estilo "bolhas": o executor quebra a resposta em 2-3 mensagens curtas (ritmo humano)
  bolhas?: boolean
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

// CHIP FORA DO AR — anti head-of-line: enquanto o chip está desconectado, o item não pode sair.
// Em vez de segurar 'pendente' na FRENTE da fila (entupindo os 20 slots do pegarDevidos e starvando
// itens novos de outros chips), a gente ADIA (joga pro fim) e, se estiver ABANDONADO há tempo
// demais, dá baixa. ADIAR curto = quando o chip volta, sai rápido; ABANDONO longo = openers de dias
// atrás não podem "ressuscitar" e virar spam.
const ADIAR_CHIP_OFFLINE_MS = 5 * 60_000 // 5 min: reavalia o item quando (talvez) o chip voltar
const ABANDONO_CHIP_OFFLINE_MS = 24 * 60 * 60_000 // 24h fora do ar → item abandonado, dead-letter

let rodando = false

async function tick() {
  // SINGLE-FLIGHT ESTRITO: nunca roda dois ticks ao mesmo tempo. (O watchdog antigo, que abria um
  // 2º ciclo por cima do 1º após 90s, ERA a causa da duplicação: dois loops pegavam o mesmo item.)
  // Não pode congelar: cada request à Evolution tem timeout de 30s (evolution.client), então um
  // tick sempre termina e libera o lock. E mesmo se dois rodassem, o claim atômico impede a duplicata.
  if (rodando) return
  rodando = true
  try {
    // REAPER periódico: recupera itens 'enviando' órfãos (processo morreu no meio) — só os ANTIGOS
    // (>120s), nunca um envio em curso. Roda a cada tick (barato: updateMany indexado com filtro de tempo).
    await filaRepo
      .reclamarPresos()
      .then((n) => n > 0 && console.log(`[fila] reaper: ${n} item(ns) órfão(s) 'enviando' → 'pendente'`))
      .catch((e) => console.error('[fila] reaper falhou (ignorado):', e))

    const devidos = await filaRepo.pegarDevidos(new Date())
    for (const item of devidos) {
      const p = item.payload as Payload
      const numero = await filaRepo.buscarNumero(p.numeroId)
      if (!numero) {
        await filaRepo.marcar(item.id, 'erro', true)
        continue
      }
      // PAUSA: missão pausada (humano assumiu) OU campanha pausada → segura o envio (fica pendente,
      // sai quando despausar). Preserva o histórico sem mandar besteira durante a edição/pausa.
      if (item.missao?.iaPausada || item.missao?.campanha?.pausada) continue
      // CHIP FORA DO AR: não tenta enviar (senão queima as 5 tentativas e vira dead-letter). Mas NÃO
      // deixa 'pendente' na frente da fila — isso ENTUPIA tudo (vários itens de um chip caído são os
      // mais antigos → pegarDevidos só via eles, pulava todos e nunca alcançava os novos de outros
      // chips: foi o que travou o teste do vendedor — 28 openers de um chip offline seguravam a fila).
      // Item velho demais → baixa; senão → adia pro fim (reavalia quando o chip voltar).
      if (numero.statusConexao !== 'conectado') {
        if (Date.now() - item.criadoEm.getTime() > ABANDONO_CHIP_OFFLINE_MS) {
          await filaRepo.marcar(item.id, 'erro', true) // chip caído há tempo demais → abandonado
        } else {
          await filaRepo.adiar(item.id, new Date(Date.now() + ADIAR_CHIP_OFFLINE_MS))
        }
        continue
      }
      // reset diário: virou o dia (no TZ) → zera o contador antes de checar o budget
      const hoje = agoraData()
      if (numero.enviadosData !== hoje) {
        await filaRepo.resetarContador(numero.id, hoje)
        numero.enviadosHoje = 0
      }

      // JANELA + BUDGET são anti-bloqueio de OUTREACH (abrir conversa nova = 'novo'). NÃO se
      // aplicam a RESPOSTAS de uma conversa ativa ('conversa'): um cliente que está falando com
      // a gente TEM que ser respondido — senão o atendimento "trava" sem aviso (o cliente do
      // Desbravando mandou msg e ficou sem resposta porque o budget diário cortou a resposta).
      // Resposta segue só o opt-out + anti-rajada (espaçamento) + chip conectado.
      // modo teste (semLimite): bypassa janela + budget de outreach (o operador aceitou o risco)
      if (p.tipo === 'novo' && !numero.semLimite) {
        if (!dentroDaJanela(agoraHHmm(), numero.janelaInicio, numero.janelaFim)) continue
        const tetoEfetivo = Math.min(
          numero.budgetDiario,
          tetoDiarioPorEstagio(numero.aquecimentoEstagio),
        )
        if (!temBudget(numero.enviadosHoje, tetoEfetivo)) continue
      }

      // OPT-OUT: o contato pediu pra parar → cancela o envio (não retenta)
      if (await filaRepo.contatoOptOut(item.contatoId)) {
        await filaRepo.marcar(item.id, 'erro')
        continue
      }

      // ANTI-RAJADA: respeita o intervalo mínimo entre envios do mesmo número.
      // (o item fica pendente e é reprocessado quando chegar a hora) — modo teste bypassa.
      const agora = Date.now()
      if (!numero.semLimite && numero.proximoEnvioEm && agora < numero.proximoEnvioEm.getTime()) {
        continue
      }

      // CLAIM ATÔMICO: só envia se ganhar a transição pendente→enviando. Se outro loop já pegou
      // este item (corrida em `pegarDevidos`, que não tranca a linha), reivindicar devolve false
      // e a gente PULA — é o que impede o mesmo opener/resposta de sair 2×, 3×, 4×.
      if (!(await filaRepo.reivindicar(item.id))) continue
      try {
        let enviados = 1
        if (p.documento) {
          await enviarDocumento(p.numeroId, p.telefone, p.documento, item.missaoId ?? undefined)
        } else {
          const r = await enviarTexto(p.numeroId, p.telefone, p.texto, item.missaoId ?? undefined, p.bolhas)
          enviados = r.bolhasEnviadas ?? 1 // bolhas contam cada uma no budget diário (anti-ban preciso)
        }
        await filaRepo.marcar(item.id, 'ok')
        await filaRepo.incrementarEnviados(p.numeroId, enviados)
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
  // O reaper agora roda DENTRO do tick (periódico, só órfãos >120s) — cobre tanto o boot quanto
  // órfãos que surgem em runtime. Não precisa mais de um reaper de boot separado.
  // .catch obrigatório: sem ele, um erro transitório de DB dentro do tick vira
  // unhandled rejection e derruba o processo (Node ≥15). O worker deve ser resiliente.
  setInterval(() => {
    tick().catch((e) => console.error('[fila] tick falhou (ignorado):', e))
  }, intervaloMs)
}
