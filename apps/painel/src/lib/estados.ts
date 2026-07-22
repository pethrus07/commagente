import type { EstadoMissao } from './types'

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
