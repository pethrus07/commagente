// 💛 Domínio — o Montador de Contexto (a "ficha" do lead).
// Regra pura: dado o estado da missão + histórico, decide o que entra no prompt.
import type { Direcao, EstadoMissao } from '@prisma/client'
import type { ContextoIA } from '../../core/ia/porta-ia'

const ULTIMAS = 8 // nº de mensagens recentes no contexto (o resto vira resumo rolante)

// compõe a "persona" (instrução de sistema) a partir da missão
function montarPersona(objetivo: string, contexto?: string | null): string {
  const linhas = [
    'Você é um assistente que conduz conversas de WhatsApp em nome de uma empresa, no ritmo humano.',
    `Objetivo desta conversa: ${objetivo}.`,
  ]
  if (contexto) linhas.push(`Contexto: ${contexto}.`)
  linhas.push(
    'Seja cordial, objetivo e natural — uma ideia por mensagem. Não invente informação.',
  )
  return linhas.join(' ')
}

// aceita a missão (com mensagens) vinda do repo; só lê os campos que precisa
type MissaoComMsgs = {
  objetivo: string
  contexto: string | null
  estado: EstadoMissao
  resumo: string | null
  fatos: unknown
  mensagens: { direcao: Direcao; conteudo: string }[]
}

export function montarFicha(missao: MissaoComMsgs): ContextoIA {
  return {
    persona: montarPersona(missao.objetivo, missao.contexto),
    objetivo: missao.objetivo,
    contexto: missao.contexto,
    estadoAtual: missao.estado,
    resumo: missao.resumo,
    fatos: (missao.fatos as Record<string, unknown> | null) ?? {},
    ultimasMensagens: missao.mensagens
      .slice(-ULTIMAS)
      .map((m) => ({ direcao: m.direcao, conteudo: m.conteudo })),
  }
}
