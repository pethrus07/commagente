// 💛/🔌 A PORTA da camada de IA (provider-agnostic) + o contrato de saída.
// O domínio/aplicação falam só com esta porta; trocar OpenAI↔Claude↔dublê = trocar o adapter.
import { EstadoMissao } from '@prisma/client'
import { z } from 'zod'

// Ficha (contexto) que entra no "prompt" — montada por features/memoria/montador.
export interface ContextoIA {
  /** instrução de sistema composta (papel + objetivo + contexto + tom + guardrails) */
  persona: string
  objetivo: string
  contexto?: string | null
  /**
   * Base de fatos AUTORIZADOS que a IA pode afirmar (preço, prazo, condições…).
   * O guardrail anti-alucinação: fora daqui, a IA não inventa — confirma ou escala.
   */
  informacoes?: string | null
  estadoAtual: EstadoMissao
  /** resumo rolante da conversa (memória de longo prazo) */
  resumo?: string | null
  fatos?: Record<string, unknown> | null
  /** memória INDIVIDUAL do contato — o que já sabemos dele de interações anteriores */
  memoriaContato?: Record<string, unknown> | null
  /** memória COLETIVA do tenant — conhecimento aprendido/curado (FAQ, objeções, políticas) */
  conhecimento?: string[] | null
  ultimasMensagens: { direcao: 'in' | 'out'; conteudo: string }[]
  /**
   * Coletor de uso de tokens (instrumentação de custo — só o provedor real preenche;
   * o dublê ignora). O harness passa um callback pra acumular por missão.
   */
  coletarUso?: (uso: UsoIA) => void
}

/** Tokens consumidos numa chamada ao provedor (pra estimar custo). */
export interface UsoIA {
  entrada: number
  saida: number
}

// Contrato de SAÍDA (structured output) — o harness valida contra isto.
export const SaidaIASchema = z.object({
  resposta: z.string().min(1),
  novo_estado: z.nativeEnum(EstadoMissao),
  categoria: z.string().nullish(),
  fatos_novos: z.record(z.unknown()).default({}),
  precisa_humano: z.boolean().default(false),
  motivo_escala: z.string().nullish(),
  /** memória coletiva: lição GERAL e reutilizável p/ a base de conhecimento (ou null) */
  aprendizado_sugerido: z.string().nullish(),
  /** desfecho da missão — preencher SÓ ao concluir (novo_estado=concluida) */
  resultado: z.string().nullish(),
})
export type SaidaIA = z.infer<typeof SaidaIASchema>

export interface ProvedorIA {
  readonly nome: string
  gerar(ctx: ContextoIA): Promise<SaidaIA>
  /** condensa a conversa num resumo rolante (memória de longo prazo) */
  resumir(ctx: ContextoIA): Promise<string>
}
