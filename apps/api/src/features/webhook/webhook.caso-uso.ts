// ⚙️ Aplicação — processa o evento normalizado do webhook.
// Fatia 3: inbound vira Mensagem (ligada à missão ativa, se houver) e destrava
// a conversa (na_fila → em_conversa). Status de entrega atualiza a msg de saída.
import { processarTurno } from '../conversa/conversa.caso-uso'
import { missoesRepo } from '../missoes/missoes.repo'
import { mapearStatusEnvio, normalizarEvento } from './webhook.dominio'
import { webhookRepo } from './webhook.repo'

export async function processarWebhook(payload: unknown) {
  const evento = normalizarEvento((payload ?? {}) as Record<string, unknown>)

  if (evento.tipo === 'mensagem') {
    if (evento.fromMe) return // nossa própria saída → tratada pelo executor
    const numero = await webhookRepo.acharNumeroPorInstancia(evento.instancia)
    if (!numero) return // instância desconhecida

    const contato = await webhookRepo.upsertContato(
      numero.tenantId,
      evento.telefone,
      evento.nome,
    )
    const missao = await missoesRepo.acharAtivaPorContatoNumero(
      numero.id,
      contato.id,
    )
    await webhookRepo.gravarMensagemEntrada({
      tenantId: numero.tenantId,
      missaoId: missao?.id ?? null,
      contatoId: contato.id,
      conteudo: evento.conteudo,
      providerMsgId: evento.providerMsgId,
    })

    // lead respondeu numa missão que estava só na fila → a conversa começou
    if (missao?.estado === 'na_fila') {
      await missoesRepo.atualizarEstado(missao.id, 'em_conversa', {
        iniciadaEm: new Date(),
      })
    }

    // Cérebro IA conduz a resposta (Fatia 4). Fire-and-forget: não segura o 200
    // do webhook (o executor simula digitação ~6s). Fatia 6 troca por fila/worker.
    if (missao) {
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
