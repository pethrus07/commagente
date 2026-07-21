// 💛/🔌 A PORTA da camada de IA (provider-agnostic) + o contrato de saída.
// O domínio/aplicação falam só com esta porta; trocar OpenAI↔Claude↔dublê = trocar o adapter.
import { EstadoMissao } from '@prisma/client'
import { z } from 'zod'

// Ficha (contexto) que entra no "prompt". Versão mínima — a Fatia 5 enriquece com memória.
export interface ContextoIA {
  objetivo: string
  contexto?: string | null
  estadoAtual: EstadoMissao
  fatos?: Record<string, unknown> | null
  ultimasMensagens: { direcao: 'in' | 'out'; conteudo: string }[]
}

// Contrato de SAÍDA (structured output) — o harness valida contra isto.
export const SaidaIASchema = z.object({
  resposta: z.string().min(1),
  novo_estado: z.nativeEnum(EstadoMissao),
  categoria: z.string().nullish(),
  fatos_novos: z.record(z.unknown()).default({}),
  precisa_humano: z.boolean().default(false),
  motivo_escala: z.string().nullish(),
})
export type SaidaIA = z.infer<typeof SaidaIASchema>

export interface ProvedorIA {
  readonly nome: string
  gerar(ctx: ContextoIA): Promise<SaidaIA>
}
