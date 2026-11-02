// ⚙️ Aplicação — o INGESTOR: o que fazer com o evento já normalizado do webhook.
// A ORDEM das guardas abaixo é o miolo desta feature, e quase toda nasceu de um defeito real em
// produção: idempotência (reentrega da Evolution) → anti-poluição da base → correção do @lid →
// fromMe do operador → suporte reativo → transcrição de áudio → opt-in/opt-out → agendar o turno.
// Nada aqui responde ao cliente: no fim, só AGENDA o turno (debounce) — quem fala é o harness.
// Evento de status de entrega segue por outro ramo, atualizando a mensagem de saída.
import { db } from '../../core/db.js'
import { whatsapp } from '../../core/evolution/index.js'
import { transcritor } from '../../core/transcricao/index.js'
import { agendarTurno } from '../conversa/conversa.caso-uso.js'
import { filaRepo } from '../fila/fila.repo.js'
import { podeTransicionar } from '../missoes/missao.dominio.js'
import { missoesRepo } from '../missoes/missoes.repo.js'
import type { AudioRecebido } from './webhook.dominio.js'
import { ehPedidoOptOut, mapearStatusEnvio, normalizarEvento } from './webhook.dominio.js'
import { webhookRepo } from './webhook.repo.js'

// REENTREGA (cura da "mensagem que não sai"): a Evolution ACEITA a mensagem (status 'enviando' +
// providerMsgId) mas depois um webhook de entrega volta ERROR/FAILED — típico do não-oficial quando
// o chip oscila. Sem isto, a resposta ao cliente sumia em silêncio. Reenfileira a MESMA resposta
// (o chip costuma estabilizar em segundos); se insistir em falhar, ESCALA pro humano.
const REENTREGA_MS = 60_000 // espera o chip estabilizar antes de reenviar
const REENTREGAS_MAX = 2 // no máx. 2 reenvios; depois escala (nunca perde o cliente em silêncio)
const ESTADOS_ENCERRADOS = ['concluida', 'descartada', 'arquivada']

async function tratarFalhaEntrega(providerMsgId: string) {
  const saida = await webhookRepo.acharSaidaPorProviderMsgId(providerMsgId)
  const m = saida?.missao
  if (!saida || !m || !m.contato || !saida.conteudo) return
  // respeita pausa/fim: humano assumiu, campanha pausada, missão encerrada ou opt-out → não re-tenta
  if (m.iaPausada || m.campanha?.pausada || m.contato.optOut) return
  if (ESTADOS_ENCERRADOS.includes(m.estado)) return

  const desde = new Date(Date.now() - 15 * 60_000)
  const falhas = await webhookRepo.contarFalhasRecentes(saida.contatoId, saida.conteudo, desde)

  if (falhas <= REENTREGAS_MAX) {
    // transitório → reenfileira a MESMA resposta pra reenviar quando o chip voltar. O dedup do
    // enfileirar (pendente/enviando com o mesmo texto) evita duplicar se o webhook vier repetido.
    await filaRepo.enfileirar({
      tenantId: saida.tenantId,
      missaoId: m.id,
      contatoId: saida.contatoId,
      payload: { numeroId: m.numeroId, telefone: m.contato.telefone, texto: saida.conteudo, tipo: 'conversa' },
      agendadoPara: new Date(Date.now() + REENTREGA_MS),
    })
    await db.evento.create({
      data: { tenantId: saida.tenantId, missaoId: m.id, tipo: 'reentrega', dados: { tentativa: falhas } },
    })
  } else {
    // esgotou as reentregas → NÃO some em silêncio: escala pro humano (aparece nos Escalados).
    const pausa = {
      iaPausada: true,
      motivoEscala: 'Falha ao ENTREGAR a resposta ao cliente (chip/instabilidade) — verifique o número e responda manualmente',
    }
    if (podeTransicionar(m.estado, 'escalada')) await missoesRepo.atualizarEstado(m.id, 'escalada', pausa)
    else await missoesRepo.atualizar(m.id, pausa)
    await db.evento.create({
      data: { tenantId: saida.tenantId, missaoId: m.id, tipo: 'entrega_falhou', dados: {} },
    })
  }
}

// Tier 3: obtém o base64 do áudio (do próprio webhook ou baixando na Evolution) e transcreve.
// Nunca lança: falha vira '' e o chamador registra a nota de voz pro operador.
async function transcreverAudio(
  instancia: string,
  audio: AudioRecebido,
): Promise<string> {
  try {
    let base64 = audio.base64
    let mimetype = audio.mimetype
    if (!base64) {
      const m = await whatsapp.baixarMidiaBase64(instancia, audio.chave)
      base64 = m.base64
      mimetype = mimetype ?? m.mimetype
    }
    if (!base64) return ''
    return await transcritor.transcrever({ base64, mimetype })
  } catch (err) {
    console.error('[audio] transcrição falhou:', err)
    return ''
  }
}

export async function processarWebhook(payload: unknown) {
  const evento = normalizarEvento((payload ?? {}) as Record<string, unknown>)

  if (evento.tipo === 'mensagem') {
    const numero = await webhookRepo.acharNumeroPorInstancia(evento.instancia)
    if (!numero) return // instância desconhecida

    // idempotência PRIMEIRO: nosso próprio envio (executor) já foi gravado, ou é reentrega da
    // Evolution → não processa 2× (vale tanto pra fromMe quanto pra recebida).
    if (
      evento.providerMsgId &&
      (await webhookRepo.existeMensagem(numero.tenantId, evento.providerMsgId))
    ) {
      return
    }

    // ⚠️ ANTI-POLUIÇÃO da base de contatos (pedido do parceiro, PRIORIDADE ALTA): num número de
    // CAMPANHA (suporte reativo OFF) NÃO cadastra contato novo a partir de um inbound/mensagem
    // qualquer — conversa particular/antiga, autoresponder, ligação, identificador @lid técnico.
    // Só entra na base quem JÁ é contato (posto por campanha ou manualmente) OU quando o número é de
    // ATENDIMENTO (suporte reativo ON → contato espontâneo é justamente o objetivo). Assim a base não
    // enche com o WhatsApp pessoal do operador.
    const existente = await webhookRepo.acharContato(numero.tenantId, evento.telefone)
    if (!existente && !numero.suporteReativo) return

    // já passou pela trava → upsert seguro (cria só no reativo; senão atualiza o existente).
    // Atualização PROGRESSIVA: nome novo (não-@lid) preenche/atualiza; @lid mantém o que já tem.
    const contato = await webhookRepo.upsertContato(
      numero.tenantId,
      evento.telefone,
      evento.ehLid ? undefined : evento.nome,
    )
    let missao = await missoesRepo.acharAtivaPorContatoNumero(numero.id, contato.id)

    // ⚠️ @lid (privacidade nova do WhatsApp): mensagem de CLIENTE chega com `fromMe:true` erroneamente
    // (o `key` não tem campo que diga quem enviou; às vezes vem certo, às vezes não). Se a conversa é
    // GERIDA PELA IA — suporte reativo OU já há MISSÃO ATIVA (a IA está tocando) — e não é o nosso
    // envio (idempotência já filtrou), então `fromMe:true` `@lid` = o cliente respondendo → trata como
    // RECEBIDA pra a IA CONTINUAR. Sem isso, a resposta do cliente virava 'out' e a conversa TRAVAVA
    // (o "conversa parada" / "áudio não continuou" do parceiro). No número dedicado à IA o humano atende
    // pelo painel, então isto não atropela o operador (decisão do Pedro).
    const reinterpretar =
      evento.fromMe && !!evento.ehLid && (numero.suporteReativo || !!missao)

    // fromMe GENUÍNO (operador digitou no celular, fora de conversa gerida pela IA) → histórico 'out'.
    // Senão, ao devolver pra IA, ela não sabe que o humano já respondeu e pode repetir/contradizer.
    if (evento.fromMe && !reinterpretar) {
      if (!evento.conteudo) return // mídia própria sem texto → fora de escopo
      await webhookRepo.gravarMensagemSaidaOperador({
        tenantId: numero.tenantId,
        missaoId: missao?.id ?? null,
        contatoId: contato.id,
        conteudo: evento.conteudo,
        providerMsgId: evento.providerMsgId,
      })
      return
    }

    // Suporte reativo: inbound sem missão ativa + número marcado como reativo →
    // abre na hora uma conversa de suporte (cobre "todos + quem entrar em contato").
    if (!missao && numero.suporteReativo) {
      missao = await missoesRepo.criar({
        tenantId: numero.tenantId,
        contatoId: contato.id,
        numeroId: numero.id,
        tipo: 'suporte',
        modo: numero.suporteModo,
        objetivo:
          numero.suporteObjetivo ??
          'Atender o contato, tirar dúvidas e resolver o que for possível — escalar para um humano quando necessário.',
        criterioConclusao: numero.suporteCriterio ?? undefined,
        tom: numero.suporteTom ?? undefined,
        informacoes: numero.suporteInformacoes ?? undefined,
        estado: 'em_conversa',
        iniciadaEm: new Date(),
      })
      await db.evento.create({
        data: { tenantId: numero.tenantId, missaoId: missao.id, tipo: 'suporte_reativo', dados: {} },
      })
    }

    // Tier 3: nota de voz → transcreve pra texto e segue o fluxo normal.
    let conteudo = evento.conteudo
    if (evento.audio) {
      const texto = await transcreverAudio(evento.instancia, evento.audio)
      await db.evento.create({
        data: {
          tenantId: numero.tenantId,
          missaoId: missao?.id ?? null,
          tipo: 'audio_transcrito',
          dados: { ok: Boolean(texto), chars: texto.length },
        },
      })
      if (!texto) {
        // não deu pra transcrever → registra a nota de voz pro operador, sem acionar a IA
        await webhookRepo.gravarMensagemEntrada({
          tenantId: numero.tenantId,
          missaoId: missao?.id ?? null,
          contatoId: contato.id,
          conteudo: '🎤 (áudio recebido — não foi possível transcrever)',
          providerMsgId: evento.providerMsgId,
        })
        return
      }
      conteudo = texto
    }

    await webhookRepo.gravarMensagemEntrada({
      tenantId: numero.tenantId,
      missaoId: missao?.id ?? null,
      contatoId: contato.id,
      conteudo,
      providerMsgId: evento.providerMsgId,
    })

    // consentimento implícito: o lead falou primeiro → registra opt-in (se ainda não houver)
    await webhookRepo.registrarOptInInbound(contato.id)

    // OPT-OUT: pediu pra parar → bloqueia envios futuros e NÃO aciona a IA
    if (ehPedidoOptOut(conteudo)) {
      await webhookRepo.marcarOptOut(contato.id)
      await db.evento.create({
        data: { tenantId: numero.tenantId, missaoId: missao?.id ?? null, tipo: 'opt_out', dados: { texto: conteudo.slice(0, 120) } },
      })
      return
    }

    // lead respondeu numa missão que estava só na fila → a conversa começou
    if (missao?.estado === 'na_fila') {
      await missoesRepo.atualizarEstado(missao.id, 'em_conversa', {
        iniciadaEm: new Date(),
      })
    }

    // Cérebro IA conduz a resposta. AGENDA o turno (debounce): se o lead mandar várias
    // mensagens seguidas, elas se acumulam e viram UM turno (anti-duplo-texto).
    // Se a IA está pausada (humano assumiu), NÃO responde — a mensagem entra no
    // histórico e o operador responde na mão pelo painel.
    if (missao && !missao.iaPausada) {
      agendarTurno(missao.id)
    }
    return
  }

  if (evento.tipo === 'status') {
    const status = mapearStatusEnvio(evento.status)
    // exige providerMsgId não-vazio: um '' faria updateMany casar TODAS as saídas sem id
    // (inclusive de outros tenants) — corrompendo status em massa.
    if (status && evento.providerMsgId) {
      await webhookRepo.atualizarStatusSaida(evento.providerMsgId, status)
      // entrega FALHOU (aceita mas não entregue) → reenvia/escala em vez de perder o cliente
      if (status === 'erro') await tratarFalhaEntrega(evento.providerMsgId)
    }
  }
}
