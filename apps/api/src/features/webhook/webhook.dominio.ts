// 💛 Domínio — normaliza o evento cru da Evolution num modelo interno (regra pura, sem I/O).
import type { StatusEnvio } from '@prisma/client'

export type EventoWa =
  | {
      tipo: 'mensagem'
      instancia: string
      telefone: string
      nome?: string
      conteudo: string
      providerMsgId: string
      fromMe: boolean
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

export function normalizarEvento(payload: Payload): EventoWa {
  const { event, instance = '', data } = payload

  if (event === 'messages.upsert') {
    const jid: string | undefined = data?.key?.remoteJid
    // ignora grupos e o status/broadcast
    if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') {
      return { tipo: 'ignorado' }
    }
    const conteudo = textoDaMensagem(data?.message)
    const telefone = telefoneDoJid(jid)
    // sem texto (mídia pura, reação, etc.) → fora do escopo da Fatia 2
    if (!conteudo || !telefone) return { tipo: 'ignorado' }
    return {
      tipo: 'mensagem',
      instancia: instance,
      telefone,
      nome: data?.pushName,
      conteudo,
      providerMsgId: data?.key?.id ?? '',
      fromMe: Boolean(data?.key?.fromMe),
    }
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
  if (['SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED'].includes(s)) return 'ok'
  if (['ERROR', 'FAILED'].includes(s)) return 'erro'
  return null
}
