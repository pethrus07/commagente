// 🔌 Infraestrutura — adapter HTTP que implementa a PortaWhatsApp via Evolution API v2.
// Referência de endpoints: Evolution API v2 (Baileys).
import { config } from '../config'
import type {
  ChaveMensagem,
  PortaWhatsApp,
  Presenca,
  QrCode,
  StatusConexaoWa,
} from './porta-whatsapp'

// Eventos que queremos receber no webhook.
const EVENTOS_WEBHOOK = [
  'MESSAGES_UPSERT', // mensagem recebida
  'MESSAGES_UPDATE', // status de entrega/leitura
  'CONNECTION_UPDATE', // mudanças de conexão
]

async function req<T>(
  metodo: string,
  caminho: string,
  corpo?: unknown,
): Promise<T> {
  const resp = await fetch(`${config.evolution.url}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.evolution.apiKey,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await resp.text()
  if (!resp.ok) {
    throw new Error(
      `Evolution ${metodo} ${caminho} → ${resp.status}: ${texto.slice(0, 300)}`,
    )
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

function mapearEstado(state?: string): StatusConexaoWa {
  if (state === 'open') return 'conectado'
  if (state === 'connecting') return 'conectando'
  return 'desconectado'
}

export const evolutionClient: PortaWhatsApp = {
  async criarInstancia(instancia) {
    await req('POST', '/instance/create', {
      instanceName: instancia,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    })
  },

  async conectar(instancia): Promise<QrCode> {
    const r = await req<{
      base64?: string
      code?: string
      pairingCode?: string
    }>('GET', `/instance/connect/${instancia}`)
    return { base64: r.base64 ?? '', codigo: r.pairingCode ?? r.code }
  },

  async statusConexao(instancia) {
    const r = await req<{ instance?: { state?: string } }>(
      'GET',
      `/instance/connectionState/${instancia}`,
    )
    return mapearEstado(r.instance?.state)
  },

  async configurarWebhook(instancia, url) {
    // v2: POST /webhook/set/{instance} com objeto "webhook" aninhado.
    await req('POST', `/webhook/set/${instancia}`, {
      webhook: {
        enabled: true,
        url,
        webhookByEvents: false,
        webhookBase64: false,
        events: EVENTOS_WEBHOOK,
      },
    })
  },

  async enviarTexto(instancia, telefone, texto) {
    const r = await req<{ key?: { id?: string } }>(
      'POST',
      `/message/sendText/${instancia}`,
      { number: telefone, text: texto },
    )
    return { providerMsgId: r.key?.id ?? '' }
  },

  async enviarPresenca(
    instancia,
    telefone,
    presenca: Presenca,
    ms = 1200,
  ) {
    await req('POST', `/chat/sendPresence/${instancia}`, {
      number: telefone,
      presence: presenca,
      delay: ms,
    })
  },

  async buscarContatos(instancia) {
    // v2: POST /chat/findContacts/{instance}. Retorna a agenda sincronizada do número.
    const r = await req<
      Array<{ id?: string; remoteJid?: string; pushName?: string; name?: string }>
    >('POST', `/chat/findContacts/${instancia}`, {})
    const lista = Array.isArray(r) ? r : []
    return lista.flatMap((c) => {
      const jid = c.id ?? c.remoteJid ?? ''
      // só contatos individuais (ignora grupos @g.us, broadcast, etc.)
      if (!jid.endsWith('@s.whatsapp.net')) return []
      const telefone = jid.split('@')[0]?.split(':')[0] ?? ''
      if (!telefone) return []
      return [{ telefone, nome: c.pushName ?? c.name ?? undefined }]
    })
  },

  async baixarMidiaBase64(instancia: string, chave: ChaveMensagem) {
    // v2: POST /chat/getBase64FromMediaMessage/{instance} → baixa e devolve a mídia em base64.
    const r = await req<{ base64?: string; mimetype?: string }>(
      'POST',
      `/chat/getBase64FromMediaMessage/${instancia}`,
      { message: { key: chave }, convertToMp4: false },
    )
    return { base64: r.base64 ?? '', mimetype: r.mimetype }
  },
}
