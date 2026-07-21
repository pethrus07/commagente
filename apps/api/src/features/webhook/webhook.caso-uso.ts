// ⚙️ Aplicação — processa o evento normalizado do webhook.
// Fatia 2 (Conexão): registra recebimento/status no audit (eventos) e captura o contato.
// O vínculo com missão + gravação em `mensagens` (memória) chega na Fatia 3/5.
import { normalizarEvento } from './webhook.dominio'
import { webhookRepo } from './webhook.repo'

export async function processarWebhook(payload: unknown) {
  const evento = normalizarEvento((payload ?? {}) as Record<string, unknown>)

  if (evento.tipo === 'mensagem') {
    if (evento.fromMe) return // nossa própria saída → tratada pelo executor
    const numero = await webhookRepo.acharNumeroPorInstancia(evento.instancia)
    if (!numero) return // instância desconhecida → ignora

    const contato = await webhookRepo.upsertContato(
      numero.tenantId,
      evento.telefone,
      evento.nome,
    )
    await webhookRepo.registrarEvento(numero.tenantId, 'mensagem_recebida', {
      contatoId: contato.id,
      telefone: evento.telefone,
      conteudo: evento.conteudo,
      providerMsgId: evento.providerMsgId,
    })
    return
  }

  if (evento.tipo === 'status') {
    const numero = await webhookRepo.acharNumeroPorInstancia(evento.instancia)
    if (!numero) return
    await webhookRepo.registrarEvento(numero.tenantId, 'status_mensagem', {
      providerMsgId: evento.providerMsgId,
      status: evento.status,
    })
  }
}
