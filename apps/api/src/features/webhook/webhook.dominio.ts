// 💛 Domínio — normaliza o evento cru da Evolution num modelo interno (regra pura, sem I/O).
import type { StatusEnvio } from '@prisma/client'
import type { ChaveMensagem } from '../../core/evolution/porta-whatsapp'

/** dados p/ obter o áudio de uma nota de voz (Tier 3) */
export interface AudioRecebido {
  chave: ChaveMensagem
  mimetype?: string
  /** base64 já embutido no webhook (se webhookBase64=true); senão baixamos sob demanda */
  base64?: string
}

export type EventoWa =
  | {
      tipo: 'mensagem'
      instancia: string
      telefone: string
      nome?: string
      conteudo: string
      providerMsgId: string
      fromMe: boolean
      /** presente quando a mensagem é uma nota de voz — a Aplicação transcreve */
      audio?: AudioRecebido
    }
  | { tipo: 'status'; instancia: string; providerMsgId: string; status: string }
  | { tipo: 'ignorado' }

type Payload = {
  event?: string
  instance?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

// "5583999999999@s.whatsapp.net" | "...@lid" → "5583999999999"
function telefoneDoJid(jid?: string): string | undefined {
  if (!jid) return undefined
  return jid.split('@')[0]?.split(':')[0]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textoDaMensagem(message: any): string | undefined {
  if (!message) return undefined
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    undefined
  )
}

// Normaliza o webhook da WhatsApp Cloud API OFICIAL (Meta) — formato diferente do Evolution:
// entry[].changes[].value.{messages[]|statuses[]}. Mapeia pro MESMO EventoWa (o resto do fluxo não muda).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizarMeta(payload: any): EventoWa {
  const value = payload?.entry?.[0]?.changes?.[0]?.value
  if (!value) return { tipo: 'ignorado' }
  const instancia = String(value.metadata?.phone_number_id ?? '') // convenção: = NumeroWhatsapp.instanciaEvolution
  const msg = value.messages?.[0]
  if (msg) {
    const telefone = String(msg.from ?? '')
    const providerMsgId = String(msg.id ?? '')
    const base = {
      tipo: 'mensagem' as const,
      instancia,
      telefone,
      nome: value.contacts?.[0]?.profile?.name as string | undefined,
      providerMsgId,
      fromMe: false, // no oficial, messages[] é sempre INBOUND (nossa saída vem em statuses[])
    }
    const texto: string | undefined =
      msg.text?.body ??
      msg.button?.text ??
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title
    if (texto) return { ...base, conteudo: texto }
    if (msg.type === 'audio' && msg.audio?.id) {
      return {
        ...base,
        conteudo: '',
        audio: { chave: { id: String(msg.audio.id), remoteJid: telefone, fromMe: false }, mimetype: msg.audio.mime_type },
      }
    }
    const midia = msg.image
      ? '📷 (imagem recebida)'
      : msg.video
        ? '🎬 (vídeo recebido)'
        : msg.document
          ? '📎 (documento recebido)'
          : msg.sticker
            ? '(figurinha recebida)'
            : msg.location
              ? '📍 (localização recebida)'
              : msg.contacts
                ? '👤 (contato recebido)'
                : undefined
    if (midia) return { ...base, conteudo: midia }
    return { tipo: 'ignorado' }
  }
  const st = value.statuses?.[0]
  if (st) {
    return { tipo: 'status', instancia, providerMsgId: String(st.id ?? ''), status: String(st.status ?? '') }
  }
  return { tipo: 'ignorado' }
}

export function normalizarEvento(payload: Payload): EventoWa {
  // Cloud API oficial (Meta): payload tem `entry[]` (formato próprio) → normalizador dedicado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((payload as any)?.entry) return normalizarMeta(payload)

  const { event, instance = '', data } = payload

  if (event === 'messages.upsert') {
    const jid: string | undefined = data?.key?.remoteJid
    // ignora grupos e o status/broadcast
    if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') {
      return { tipo: 'ignorado' }
    }
    const telefone = telefoneDoJid(jid)
    if (!telefone) return { tipo: 'ignorado' }
    const providerMsgId: string = data?.key?.id ?? ''
    const fromMe = Boolean(data?.key?.fromMe)
    const base = {
      tipo: 'mensagem' as const,
      instancia: instance,
      telefone,
      nome: data?.pushName,
      providerMsgId,
      fromMe,
    }

    const conteudo = textoDaMensagem(data?.message)
    if (conteudo) return { ...base, conteudo }

    // Tier 3: nota de voz → a Aplicação transcreve e segue o fluxo de texto normal.
    const audioMsg = data?.message?.audioMessage
    if (audioMsg) {
      return {
        ...base,
        conteudo: '',
        audio: {
          chave: { id: providerMsgId, remoteJid: jid, fromMe },
          mimetype: audioMsg.mimetype,
          // base64 pode vir embutido (webhookBase64=true) em vários lugares
          base64: data?.message?.base64 ?? data?.base64 ?? audioMsg.base64,
        },
      }
    }

    // outras mídias SEM texto (imagem/vídeo/doc/figurinha/localização): não somem no vácuo —
    // registra um placeholder pra aparecer no painel e a IA/operador reagir (antes: perdido).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = data?.message ?? {}
    const midia = m.imageMessage
      ? '📷 (imagem recebida)'
      : m.videoMessage
        ? '🎬 (vídeo recebido)'
        : m.documentMessage || m.documentWithCaptionMessage
          ? '📎 (documento recebido)'
          : m.audioMessage
            ? '🎤 (áudio recebido)'
            : m.stickerMessage
              ? '(figurinha recebida)'
              : m.locationMessage
                ? '📍 (localização recebida)'
                : m.contactMessage || m.contactsArrayMessage
                  ? '👤 (contato recebido)'
                  : undefined
    if (midia) return { ...base, conteudo: midia }

    // reação, protocolo, etc. → realmente sem conteúdo tratável
    return { tipo: 'ignorado' }
  }

  if (event === 'messages.update') {
    const providerMsgId: string | undefined = data?.key?.id ?? data?.keyId
    const status: string | undefined = data?.status ?? data?.update?.status
    if (!providerMsgId || !status) return { tipo: 'ignorado' }
    return {
      tipo: 'status',
      instancia: instance,
      providerMsgId,
      status: String(status),
    }
  }

  return { tipo: 'ignorado' }
}

// detecta pedido de opt-out ("PARAR", "sair da lista", etc.) — sinais fortes só,
// pra não confundir com objeção normal no meio da conversa ("não quero o plano caro").
const RE_OPTOUT =
  /(^| )(parar|pare|stop|unsubscribe|sair da lista|cancelar inscri\w*|descadastr\w+|me (remov\w+|tir\w+ da lista)|para de (me )?(mandar|enviar|perturbar)|nao (quero (mais )?receber|perturbe|me (mande|envie)))( |$|!|\.|,)/

export function ehPedidoOptOut(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()
  return RE_OPTOUT.test(t)
}

// mapeia o status cru da Evolution para o nosso StatusEnvio (ou null se irrelevante)
export function mapearStatusEnvio(evoStatus: string): StatusEnvio | null {
  const s = evoStatus.toUpperCase()
  // Evolution (Baileys): SERVER_ACK/DELIVERY_ACK/READ/PLAYED · Cloud API (Meta): SENT/DELIVERED/READ
  if (['SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED', 'SENT', 'DELIVERED'].includes(s)) return 'ok'
  if (['ERROR', 'FAILED'].includes(s)) return 'erro'
  return null
}
