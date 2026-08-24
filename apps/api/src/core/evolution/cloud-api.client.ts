// 🔌 Infraestrutura — adapter da WhatsApp Cloud API OFICIAL (Meta) — degrau 1 da escada.
// Implementa a MESMA PortaWhatsApp do Evolution → as features (ingestor, harness, fila) NÃO mudam.
// Ativado por WHATSAPP_PROVIDER=cloud. Resolve o "aguardando esta mensagem" da via não-oficial:
// no oficial não há Baileys nem decifração falha — a Meta entrega de verdade.
//
// ⚠️ Limitações do degrau 1 (documentadas em docs/escada-api-oficial.md):
//  - NÃO tem QR: o número é registrado na conta Meta Business (phone_number_id + token permanente).
//  - RESPOSTAS (texto livre) só valem DENTRO da janela de 24h após a última msg do cliente — que é
//    exatamente o caso do "responder o cliente engajado" (o que estava com aguardando). ✅
//  - OPENER frio fora da janela exige TEMPLATE aprovado (enviarTemplate) — degrau 1+ (TODO).
//  - Degrau 1 usa credenciais GLOBAIS (config.cloud); por-número (híbrido, degrau 2) vem depois.
//    Convenção: o `NumeroWhatsapp.instanciaEvolution` do número oficial = o phone_number_id.
import { config } from '../config'
import type {
  ChaveMensagem,
  PortaWhatsApp,
  Presenca,
  QrCode,
  StatusConexaoWa,
} from './porta-whatsapp'

const graphBase = () => `https://graph.facebook.com/${config.cloud.graphVersion}`
const soDigitos = (t: string) => t.replace(/\D/g, '') // Cloud API quer o número em dígitos (E.164 sem +)

async function graph<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resp = await fetch(`${graphBase()}${caminho}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.cloud.token}`,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(30_000), // não pendura o worker se a Meta travar
  })
  const texto = await resp.text()
  if (!resp.ok) {
    throw new Error(`CloudAPI ${metodo} ${caminho} → ${resp.status}: ${texto.slice(0, 300)}`)
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

// upload de mídia (base64) → media_id (o send por link exige URL pública; por id é mais simples)
async function uploadMedia(base64: string, mimetype: string, filename: string): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimetype)
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mimetype }), filename)
  const resp = await fetch(`${graphBase()}/${config.cloud.phoneNumberId}/media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.cloud.token}` }, // multipart: NÃO setar content-type
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
  const j = (await resp.json()) as { id?: string }
  if (!resp.ok || !j.id) {
    throw new Error(`CloudAPI upload media → ${resp.status}: ${JSON.stringify(j).slice(0, 200)}`)
  }
  return j.id
}

type MsgResp = { messages?: { id?: string }[] }

export const cloudApiClient: PortaWhatsApp = {
  // Cloud API não tem instância/sessão volátil nem QR — o número já existe na Meta.
  async criarInstancia() {
    /* no-op: registro do número é feito no painel da Meta (WhatsApp > API Setup) */
  },

  async conectar(): Promise<QrCode> {
    // não há QR no oficial; "conectar" = ter token + phone_number_id válidos.
    return { base64: '', codigo: undefined }
  },

  async statusConexao(): Promise<StatusConexaoWa> {
    // sem sessão que cai; se há credenciais configuradas, o número está operante.
    return config.cloud.token && config.cloud.phoneNumberId ? 'conectado' : 'desconectado'
  },

  async desconectar() {
    /* no-op: o oficial não tem sessão/logout — o número vive na Meta, não em instância volátil */
  },

  async removerInstancia() {
    /* no-op: remover o número do sistema não desfaz o cadastro na Meta */
  },

  async configurarWebhook() {
    // O webhook do oficial é cadastrado UMA vez no painel da Meta (App > WhatsApp > Configuration:
    // Callback URL + Verify Token = CLOUD_API_VERIFY_TOKEN), não por chamada de API por número.
    /* no-op */
  },

  async enviarTexto(_instancia, telefone, texto) {
    const r = await graph<MsgResp>('POST', `/${config.cloud.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: soDigitos(telefone),
      type: 'text',
      text: { body: texto, preview_url: false },
    })
    return { providerMsgId: r.messages?.[0]?.id ?? '' }
  },

  async enviarDocumento(_instancia, telefone, doc) {
    const mediaId = await uploadMedia(doc.base64, doc.mimetype ?? 'application/pdf', doc.nomeArquivo)
    const r = await graph<MsgResp>('POST', `/${config.cloud.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: soDigitos(telefone),
      type: 'document',
      document: { id: mediaId, filename: doc.nomeArquivo, caption: doc.legenda },
    })
    return { providerMsgId: r.messages?.[0]?.id ?? '' }
  },

  // Cloud API não tem "digitando…" público. Best-effort: marca a última msg recebida como lida
  // (dá o "visto", que humaniza) — o ritmo/atraso humano já é do worker anti-bloqueio.
  async enviarPresenca(_instancia, _telefone, _presenca: Presenca, _ms) {
    /* no-op no degrau 1 (read-receipt opcional depende do message_id, tratado no ingestor) */
  },

  async buscarContatos() {
    // Indisponível no oficial: contatos vêm de OPT-IN, não da agenda do aparelho.
    return []
  },

  async baixarMidiaBase64(_instancia, chave: ChaveMensagem) {
    // no oficial, o id da mídia → GET /{media-id} devolve uma URL temporária; baixa com o token.
    const meta = await graph<{ url?: string; mime_type?: string }>('GET', `/${chave.id}`)
    if (!meta.url) return { base64: '', mimetype: meta.mime_type }
    const bin = await fetch(meta.url, {
      headers: { authorization: `Bearer ${config.cloud.token}` },
      signal: AbortSignal.timeout(30_000),
    })
    const buf = Buffer.from(await bin.arrayBuffer())
    return { base64: buf.toString('base64'), mimetype: meta.mime_type }
  },
}
