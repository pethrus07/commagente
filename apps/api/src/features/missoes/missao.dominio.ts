// 💛 Domínio (puro) — a máquina de estados da missão.
// Referência: docs/estudos/ARQUITETURA-TECNICA.md §3.
import type { EstadoMissao } from '@prisma/client'
import { ErroHttp } from '../../core/erros'

// De cada estado, para quais estados é permitido ir.
export const TRANSICOES: Record<EstadoMissao, EstadoMissao[]> = {
  configurada: ['na_fila', 'descartada', 'arquivada'],
  na_fila: ['em_conversa', 'descartada', 'arquivada'],
  em_conversa: ['concluida', 'sem_resposta', 'descartada', 'escalada'],
  escalada: ['em_conversa', 'concluida', 'descartada', 'arquivada'],
  concluida: ['arquivada'],
  sem_resposta: ['na_fila', 'arquivada'],
  descartada: ['arquivada'],
  arquivada: [], // terminal
}

export function podeTransicionar(de: EstadoMissao, para: EstadoMissao): boolean {
  return TRANSICOES[de]?.includes(para) ?? false
}

// Valida a transição; mesmo-estado é no-op permitido. Lança 409 se inválida.
export function validarTransicao(de: EstadoMissao, para: EstadoMissao): void {
  if (de === para) return
  if (!podeTransicionar(de, para)) {
    throw new ErroHttp(409, `Transição de estado inválida: ${de} → ${para}`)
  }
}
