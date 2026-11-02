// 💛 Domínio (puro) — a máquina de estados da missão.
// Referência: docs/estudos/ARQUITETURA-TECNICA.md §3.
import type { EstadoMissao } from '@prisma/client'
import { ErroHttp } from '../../core/erros.js'

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

// Transições que ATIVAM a missão — feitas SÓ pelo sistema (botão "Iniciar" / resposta do cliente),
// NUNCA pela mudança manual de estado. Blindagem: mexer no status na mão "pulava" o Iniciar e a
// missão ficava muda (nunca gerava o opener). O fluxo interno usa `podeTransicionar`/`atualizarEstado`
// e NÃO passa por `validarTransicao`, então continua livre — o bloqueio vale só pro caminho manual.
const SO_SISTEMA: readonly (readonly [EstadoMissao, EstadoMissao])[] = [
  ['configurada', 'na_fila'], // iniciar → use o botão "Iniciar" (é ele que gera e envia a abertura)
  ['na_fila', 'em_conversa'], // o sistema move quando o opener sai / o cliente responde
  ['sem_resposta', 'na_fila'], // re-disparar não é mudança de status na mão
]

export function ehTransicaoSoSistema(de: EstadoMissao, para: EstadoMissao): boolean {
  return SO_SISTEMA.some(([a, b]) => a === de && b === para)
}

// Valida a transição MANUAL (rota mudarEstado); mesmo-estado é no-op permitido. Lança 409 se inválida
// OU se for uma transição que só o sistema pode fazer (com dica clara pro usuário).
export function validarTransicao(de: EstadoMissao, para: EstadoMissao): void {
  if (de === para) return
  if (!podeTransicionar(de, para)) {
    throw new ErroHttp(409, `Transição de estado inválida: ${de} → ${para}`)
  }
  if (ehTransicaoSoSistema(de, para)) {
    throw new ErroHttp(
      409,
      de === 'configurada'
        ? 'Pra ativar a missão, use o botão "Iniciar" — é ele que gera e envia a mensagem de abertura. Mudar o status na mão pula esse passo.'
        : 'Esse status é controlado pelo sistema conforme a conversa anda — não dá pra mudar na mão.',
    )
  }
}
