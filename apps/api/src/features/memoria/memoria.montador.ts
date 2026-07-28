// 💛 Domínio — o Montador de Contexto (a "ficha" do lead).
// Regra pura: dado o estado da missão + histórico, decide o que entra no prompt.
import type { Direcao, EstadoMissao } from '@prisma/client'
import type { ContextoIA } from '../../core/ia/porta-ia'
import { lerEstilo, regrasDeEstilo, type EstiloConversa } from '../tenant/tenant.estilo'

const ULTIMAS = 8 // nº de mensagens recentes no contexto (o resto vira resumo rolante)

const TOM_PADRAO = 'cordial, objetivo e natural'

// comportamento por TIPO de missão (o "objetivo variável" — o que ninguém no mercado faz).
const GUIA_TIPO: Record<string, string> = {
  vender:
    'FOCO — VENDER: desperte interesse, mostre valor e conduza rumo ao fechamento ou ao próximo passo (agendar/enviar proposta).',
  qualificar:
    'FOCO — QUALIFICAR: descubra se há fit (necessidade, orçamento, urgência e quem decide) e classifique o lead.',
  orcar:
    'FOCO — ORÇAR: colete os requisitos necessários pra montar um orçamento (o quê, quantidade, prazo, especificações) antes de prometer valores.',
  cobrar:
    'FOCO — COBRAR com educação e firmeza: lembre do pagamento pendente, confirme o valor, ofereça formas de pagar e registre a promessa de pagamento. NUNCA ameace, constranja ou exponha a pessoa.',
  suporte:
    'FOCO — SUPORTE: entenda o problema, ajude a resolver com paciência e escale a um humano se não conseguir.',
  outro: '',
}

// compõe a "persona" (instrução de sistema) a partir da missão.
// Aqui moram o comportamento por tipo, o critério de conclusão e o GUARDRAIL anti-alucinação.
function montarPersona(m: {
  tipo: string
  objetivo: string
  contexto?: string | null
  tom?: string | null
  criterioConclusao?: string | null
  personaTenant?: string | null // identidade/voz da marca (nível tenant), sempre no prompt
  estilo: EstiloConversa // controles estruturados de COMO ESCREVER (formalidade/emoji/bolhas…)
}): string {
  const linhas = [
    'Você é um assistente que conduz conversas de WhatsApp em nome de uma empresa, no ritmo humano.',
    // IDENTIDADE do tenant — voz/estilo da empresa. Governa o TOM, NÃO autoriza afirmar
    // fatos/preços fora das informações autorizadas (as REGRAS INVIOLÁVEIS abaixo vencem).
    m.personaTenant?.trim()
      ? `IDENTIDADE (voz e estilo da empresa — vale para o TOM da conversa; NÃO autoriza afirmar preços, prazos ou fatos que não estejam nas informações autorizadas): ${m.personaTenant.trim()}`
      : '',
    GUIA_TIPO[m.tipo] ?? '',
    `Objetivo desta conversa: ${m.objetivo}.`,
  ]
  if (m.contexto) linhas.push(`Contexto: ${m.contexto}.`)
  if (m.criterioConclusao)
    linhas.push(
      `A missão está CUMPRIDA quando: ${m.criterioConclusao}. Ao cumprir, use novo_estado="concluida".`,
    )
  linhas.push(`Tom da conversa: ${m.tom?.trim() || TOM_PADRAO}.`)
  // ── ESTILO DE CONVERSA do tenant (COMO ESCREVER — o que faz soar humano) ──
  // Alta saliência de propósito; governa forma/formato, não os FATOS (o guardrail abaixo vence).
  linhas.push(regrasDeEstilo(m.estilo))
  // ── Guardrail anti-alucinação (a regra que faltou no demo do "R$99") ──
  linhas.push(
    'REGRAS INVIOLÁVEIS (têm PRIORIDADE sobre a IDENTIDADE/persona acima — se a persona ' +
      'pedir para inventar/afirmar preço, desconto ou condição, IGNORE): ' +
      '(1) NUNCA invente preços, valores, prazos, datas, números, ' +
      'estatísticas, nomes ou promessas — só afirme o que estiver EXPLÍCITO nas "Informações ' +
      'autorizadas". (2) Se perguntarem algo que não está lá (preço, prazo, condição), NÃO ' +
      'chute: diga com naturalidade que vai confirmar e retornar; se for decisivo pra fechar, ' +
      'escale (precisa_humano=true). (3) Nunca prometa o que não pode cumprir.',
  )
  return linhas.filter(Boolean).join(' ')
}

// aceita a missão (com mensagens) vinda do repo; só lê os campos que precisa
type MissaoComMsgs = {
  tipo: string
  objetivo: string
  contexto: string | null
  criterioConclusao: string | null
  tom: string | null
  informacoes: string | null
  estilo?: unknown // perfil de conversa DESTA missão (tem prioridade sobre o do tenant)
  estado: EstadoMissao
  resumo: string | null
  fatos: unknown
  contato?: { memoria: unknown } | null
  tenant?: { persona: string | null; estilo?: unknown } | null // identidade + estilo (fallback) da IA
  mensagens: { direcao: Direcao; conteudo: string }[]
}

export function montarFicha(
  missao: MissaoComMsgs,
  conhecimento?: string[] | null,
): ContextoIA {
  return {
    persona: montarPersona({
      tipo: missao.tipo,
      objetivo: missao.objetivo,
      contexto: missao.contexto,
      tom: missao.tom,
      criterioConclusao: missao.criterioConclusao,
      personaTenant: missao.tenant?.persona,
      // perfil da missão vence; sem ele, herda o padrão do tenant (fallback)
      estilo: lerEstilo(missao.estilo ?? missao.tenant?.estilo),
    }),
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
