// 💛 Domínio — a PORTA (interface) da camada de WhatsApp.
// O domínio fala só com esta porta; quem implementa (Evolution) é detalhe de Infra.
// Trocar de provider de WhatsApp = trocar o adapter, sem tocar aqui.

export type StatusConexaoWa = 'desconectado' | 'conectando' | 'conectado'

export interface QrCode {
  /** imagem do QR em data-URL base64 (pra exibir no painel) */
  base64: string
  /** código de pareamento alternativo (opcional) */
  codigo?: string
}

export type Presenca = 'composing' | 'paused'

export interface PortaWhatsApp {
  /** cria a instância/sessão na ponte (idempotente do lado de quem chama) */
  criarInstancia(instancia: string): Promise<void>
  /** inicia a conexão e devolve o QR pra escanear */
  conectar(instancia: string): Promise<QrCode>
  /** estado atual da sessão */
  statusConexao(instancia: string): Promise<StatusConexaoWa>
  /** aponta o webhook de eventos (mensagens recebidas, status) pra nossa API */
  configurarWebhook(instancia: string, url: string): Promise<void>
  /** envia texto; retorna o id da mensagem no provider */
  enviarTexto(
    instancia: string,
    telefone: string,
    texto: string,
  ): Promise<{ providerMsgId: string }>
  /** sinaliza presença (ex.: "digitando…") por alguns ms — anti-bloqueio */
  enviarPresenca(
    instancia: string,
    telefone: string,
    presenca: Presenca,
    ms?: number,
  ): Promise<void>
}
