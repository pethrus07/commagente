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
    // sem timeout, um request pendurado congela o worker (lock `rodando`) e trava a fila
    signal: AbortSignal.timeout(30_000),
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

export type ContatoEvolution = { id?: string; remoteJid?: string; pushName?: string; name?: string }

// Mapeia a resposta de /chat/findContacts → { telefone, nome }. Pura (testável sem HTTP).
// ⚠️ Evolution v2.3.1: `id` é um CUID interno; o JID de verdade está em `remoteJid`. Em versões
// antigas `id` ERA o JID (daí o fallback). Preferir remoteJid — senão o filtro descarta tudo (0).
export function mapearContatosEvolution(
  lista: ContatoEvolution[],
): { telefone: string; nome?: string }[] {
  return lista.flatMap((c) => {
    const jid = c.remoteJid ?? c.id ?? ''
    // só contatos individuais (ignora grupos @g.us, broadcast, etc.)
    if (!jid.endsWith('@s.whatsapp.net')) return []
    const telefone = jid.split('@')[0]?.split(':')[0] ?? ''
    if (!telefone) return []
    return [{ telefone, nome: c.pushName ?? c.name ?? undefined }]
  })
}

export const evolutionClient: PortaWhatsApp = {
  async criarInstancia(instancia) {
    await req('POST', '/instance/create', {
      instanceName: instancia,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    })
    // Settings de robustez (mitiga o "aguardando esta mensagem"/desync de chaves do Baileys e dá
    // higiene pra um bot 1:1): IGNORA GRUPOS (causa nº1 de desync de LID → "waiting for this message"
    // em 2026), rejeita chamadas e não puxa histórico pesado no connect. Best-effort: não derruba a
    // criação se a versão do Evolution não aceitar algum campo.
    await req('POST', `/settings/set/${instancia}`, {
      rejectCall: true,
      msgCall: '',
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    }).catch((e) =>
      console.error('[evolution] settings best-effort falhou (ignorado):', (e as Error)?.message),
    )
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

  async enviarDocumento(instancia, telefone, doc) {
    // v2: POST /message/sendMedia/{instance}. O mediatype vem do mimetype: imagem chega inline,
    // áudio como nota de voz, vídeo como vídeo — só o resto (PDF/planilha/etc.) vai como documento.
    const mime = doc.mimetype ?? 'application/pdf'
    const audio = mime.startsWith('audio/')
    const mediatype = mime.startsWith('image/') ? 'image' : audio ? 'audio' : mime.startsWith('video/') ? 'video' : 'document'
    if (audio) {
      // áudio tem endpoint próprio (nota de voz tocável) — sem fileName/caption
      const r = await req<{ key?: { id?: string } }>('POST', `/message/sendWhatsAppAudio/${instancia}`, {
        number: telefone,
        audio: doc.base64,
      })
      return { providerMsgId: r.key?.id ?? '' }
    }
    const r = await req<{ key?: { id?: string } }>('POST', `/message/sendMedia/${instancia}`, {
      number: telefone,
      mediatype,
      mimetype: mime,
      media: doc.base64,
      fileName: doc.nomeArquivo,
      caption: doc.legenda,
    })
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
    const r = await req<ContatoEvolution[]>('POST', `/chat/findContacts/${instancia}`, {})
    return mapearContatosEvolution(Array.isArray(r) ? r : [])
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
