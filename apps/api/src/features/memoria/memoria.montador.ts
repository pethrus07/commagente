// 💛 Domínio — o Montador de Contexto (a "ficha" do lead).
// Regra pura: dado o estado da missão + histórico, decide o que entra no prompt.
import type { Direcao, EstadoMissao } from '@prisma/client'
import type { ContextoIA } from '../../core/ia/porta-ia'

const ULTIMAS = 8 // nº de mensagens recentes no contexto (o resto vira resumo rolante)

const TOM_PADRAO = 'cordial, objetivo e natural'

// compõe a "persona" (instrução de sistema) a partir da missão.
// Aqui mora o GUARDRAIL anti-alucinação (regra provider-agnostic).
function montarPersona(
  objetivo: string,
  contexto?: string | null,
  tom?: string | null,
): string {
  const linhas = [
    'Você é um assistente que conduz conversas de WhatsApp em nome de uma empresa, no ritmo humano.',
    `Objetivo desta conversa: ${objetivo}.`,
  ]
  if (contexto) linhas.push(`Contexto: ${contexto}.`)
  linhas.push(`Tom da conversa: ${tom?.trim() || TOM_PADRAO}. Uma ideia por mensagem.`)
  // ── Guardrail anti-alucinação (a regra que faltou no demo do "R$99") ──
  linhas.push(
    'REGRAS INVIOLÁVEIS: (1) NUNCA invente preços, valores, prazos, datas, números, ' +
      'estatísticas, nomes ou promessas — só afirme o que estiver EXPLÍCITO nas "Informações ' +
      'autorizadas". (2) Se perguntarem algo que não está lá (preço, prazo, condição), NÃO ' +
      'chute: diga com naturalidade que vai confirmar e retornar; se for decisivo pra fechar, ' +
      'escale (precisa_humano=true). (3) Nunca prometa o que não pode cumprir.',
  )
  return linhas.join(' ')
}

// aceita a missão (com mensagens) vinda do repo; só lê os campos que precisa
type MissaoComMsgs = {
  objetivo: string
  contexto: string | null
  tom: string | null
  informacoes: string | null
  estado: EstadoMissao
  resumo: string | null
  fatos: unknown
  contato?: { memoria: unknown } | null
  mensagens: { direcao: Direcao; conteudo: string }[]
}

export function montarFicha(
  missao: MissaoComMsgs,
  conhecimento?: string[] | null,
): ContextoIA {
  return {
    persona: montarPersona(missao.objetivo, missao.contexto, missao.tom),
    objetivo: missao.objetivo,
    contexto: missao.contexto,
    informacoes: missao.informacoes,
    estadoAtual: missao.estado,
    resumo: missao.resumo,
    fatos: (missao.fatos as Record<string, unknown> | null) ?? {},
    memoriaContato:
      (missao.contato?.memoria as Record<string, unknown> | null) ?? null,
    conhecimento: conhecimento ?? null,
    ultimasMensagens: missao.mensagens
      .slice(-ULTIMAS)
      .map((m) => ({ direcao: m.direcao, conteudo: m.conteudo })),
  }
}
