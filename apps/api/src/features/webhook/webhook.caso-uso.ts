// ⚙️ Aplicação — processa o evento normalizado do webhook.
// Fatia 3: inbound vira Mensagem (ligada à missão ativa, se houver) e destrava
// a conversa (na_fila → em_conversa). Status de entrega atualiza a msg de saída.
import { db } from '../../core/db'
import { whatsapp } from '../../core/evolution'
import { transcritor } from '../../core/transcricao'
import { processarTurno } from '../conversa/conversa.caso-uso'
import { missoesRepo } from '../missoes/missoes.repo'
import type { AudioRecebido } from './webhook.dominio'
import { ehPedidoOptOut, mapearStatusEnvio, normalizarEvento } from './webhook.dominio'
import { webhookRepo } from './webhook.repo'

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
    if (evento.fromMe) return // nossa própria saída → tratada pelo executor
    const numero = await webhookRepo.acharNumeroPorInstancia(evento.instancia)
    if (!numero) return // instância desconhecida

    // idempotência: a Evolution pode reentregar o mesmo evento → não processa 2×
    if (
      evento.providerMsgId &&
      (await webhookRepo.existeMensagem(numero.tenantId, evento.providerMsgId))
    ) {
      return
    }

    const contato = await webhookRepo.upsertContato(
      numero.tenantId,
      evento.telefone,
      evento.nome,
    )
    const missao = await missoesRepo.acharAtivaPorContatoNumero(
      numero.id,
      contato.id,
    )

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

    // Cérebro IA conduz a resposta (Fatia 4). Fire-and-forget: não segura o 200
    // do webhook (o executor simula digitação ~6s). Fatia 6 troca por fila/worker.
    // Fatia 9: se a missão está com a IA pausada (humano assumiu), NÃO responde —
    // a mensagem entra no histórico e o operador responde na mão pelo painel.
    if (missao && !missao.iaPausada) {
      void processarTurno(missao.id).catch((err) =>
        console.error('[conversa] processarTurno falhou:', err),
      )
    }
    return
  }

  if (evento.tipo === 'status') {
    const status = mapearStatusEnvio(evento.status)
    if (status) await webhookRepo.atualizarStatusSaida(evento.providerMsgId, status)
  }
}
