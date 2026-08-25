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
  /**
   * Características do contato vindas das TAGS (ex.: "Cliente VIP: atenção máxima").
   * Camada COMPLEMENTAR de conhecimento — considere, mas não substitui persona/informações.
   */
  caracteristicasContato?: string[] | null
  /**
   * DNA DESTE CONTATO — conhecimento estruturado sobre a pessoa (perfil/comunicação/
   * histórico/observações), já compilado. PERSONALIZAÇÃO, não fonte de fato: use pra ajustar
   * a abordagem; NÃO autoriza afirmar preço/fato (o guardrail anti-invenção segue valendo).
   */
  dnaContato?: string | null
  /** memória COLETIVA do tenant — conhecimento aprendido/curado (FAQ, objeções, políticas) */
  conhecimento?: string[] | null
  /** mídias da biblioteca que a IA PODE enviar (catálogo, tabela de preço…) — id + nome */
  midiasDisponiveis?: { id: string; nome: string }[] | null
  /**
   * DNA da empresa — conhecimento estruturado por categorias (empresa, produtos, preços…),
   * já compilado e dentro do orçamento de contexto. Fonte AUTORIZADA (como `informacoes`).
   * As Regras de Negócio do DNA entram na `persona` como regra inviolável, não aqui.
   */
  dnaConhecimento?: string | null
  /**
   * MODO ROTEIRO (§FactoryHub) — o passo ATUAL da sequência guiada, já compilado em texto.
   * `instrucao` = o que fazer neste turno; `menu` = rótulos quando o passo ramifica.
   * null = missão fora de roteiro (conversa livre) OU roteiro concluído sem resumo.
   */
  roteiro?: { instrucao: string; menu?: string[] } | null
  ultimasMensagens: { direcao: 'in' | 'out'; conteudo: string }[]
}

/** Tokens consumidos numa chamada ao provedor (pra estimar custo). */
export interface UsoIA {
  entrada: number
  saida: number
}

/** Pergunta do operador + retrato estruturado dos dados do tenant (Central de Inteligência #7). */
export interface DadosAnalise {
  pergunta: string
  /** snapshot JSON dos dados da conta (contadores, campanhas, desfechos…) — a ÚNICA fonte da resposta */
  snapshot: unknown
}

/** Dados agregados de uma campanha, pra IA consolidar num relatório gerencial. */
export interface DadosSintese {
  objetivo: string
  tipo: string
  total: number
  /** uma linha por contato/conversa da campanha */
  linhas: {
    contato: string
    estado: string
    resultado?: string | null
    resumo?: string | null
    fatos: Record<string, unknown>
  }[]
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
  /** id de uma mídia da biblioteca a enviar AGORA (catálogo/tabela) — só quando fizer sentido */
  enviar_midia: z.string().nullish(),
  /** MODO ROTEIRO: num passo de MENU, o rótulo que o cliente escolheu (senão null) */
  opcao_roteiro: z.string().nullish(),
  /** desfecho da missão — preencher SÓ ao concluir (novo_estado=concluida) */
  resultado: z.string().nullish(),
})
export type SaidaIA = z.infer<typeof SaidaIASchema>

export interface ProvedorIA {
  readonly nome: string
  /** gera a resposta (structured) e, quando o provedor sabe, o uso de tokens da chamada. */
  gerar(ctx: ContextoIA): Promise<{ saida: SaidaIA; uso?: UsoIA }>
  /** condensa a conversa num resumo rolante (memória de longo prazo). */
  resumir(ctx: ContextoIA): Promise<{ texto: string; uso?: UsoIA }>
  /** consolida os dados coletados numa campanha num relatório gerencial narrativo. */
  sintetizar(dados: DadosSintese): Promise<{ texto: string; uso?: UsoIA }>
  /** responde uma pergunta em linguagem natural SÓ com base no snapshot dos dados (grounded). */
  analisar(dados: DadosAnalise): Promise<{ texto: string; uso?: UsoIA }>
}
