import type { EstadoMissao, TipoMissao } from './types'

// tipos de missão (o "objetivo variável") — rótulos p/ o painel
export const TIPO_INFO: Record<TipoMissao, { label: string; emoji: string }> = {
  vender: { label: 'Vender', emoji: '💰' },
  qualificar: { label: 'Qualificar', emoji: '🔍' },
  orcar: { label: 'Orçar', emoji: '🧾' },
  cobrar: { label: 'Cobrar', emoji: '⏰' },
  suporte: { label: 'Suporte', emoji: '🛟' },
  outro: { label: 'Outro', emoji: '•' },
}
export const TIPOS_MISSAO = Object.keys(TIPO_INFO) as TipoMissao[]

// rótulo amigável de um número: o apelido se houver, senão o telefone (com +)
export function rotuloNumero(n: { apelido?: string | null; telefone: string }): string {
  return n.apelido?.trim() || `+${n.telefone}`
}

// espelho da máquina de estados do domínio (transições válidas → mostra ações e valida o drag)
export const TRANSICOES: Record<EstadoMissao, EstadoMissao[]> = {
  configurada: ['na_fila', 'descartada', 'arquivada'],
  na_fila: ['em_conversa', 'descartada', 'arquivada'],
  em_conversa: ['concluida', 'sem_resposta', 'descartada', 'escalada'],
  escalada: ['em_conversa', 'concluida', 'descartada', 'arquivada'],
  concluida: ['arquivada'],
  sem_resposta: ['na_fila', 'arquivada'],
  descartada: ['arquivada'],
  arquivada: [],
}

// ordem das colunas do board (pipeline da conversa)
export const COLUNAS: EstadoMissao[] = [
  'configurada',
  'na_fila',
  'em_conversa',
  'escalada',
  'concluida',
  'sem_resposta',
  'descartada',
  'arquivada',
]

export function podeTransicionar(de: EstadoMissao, para: EstadoMissao): boolean {
  return TRANSICOES[de].includes(para)
}

// rótulos amigáveis dos motivos de "pulo" no disparo em lote
const MOTIVO_DISPARO: Record<string, string> = {
  ja_iniciada: 'já iniciadas',
  opt_out: 'em opt-out',
  saude_risco: 'seguradas (número em risco de bloqueio)',
  cap_ativas: 'acima do limite de conversas ativas do número',
  cap_contato: 'contato já abordado 2×/semana',
  inexistente: 'não encontradas',
  erro: 'com erro',
}

// transforma o relatório do disparo num texto curto pro toast
export function descreverDisparo(r: { iniciadas: number; puladas: Record<string, number> }): string {
  const partes = [`${r.iniciadas} iniciada${r.iniciadas === 1 ? '' : 's'}`]
  for (const [k, n] of Object.entries(r.puladas)) {
    if (n > 0) partes.push(`${n} ${MOTIVO_DISPARO[k] ?? k}`)
  }
  return partes.join(' · ')
}
