// 💛 Domínio — o Montador de Contexto (a "ficha" do lead).
// Regra pura: dado o estado da missão + histórico, decide o que entra no prompt.
import type { Direcao, EstadoMissao } from '@prisma/client'
import type { ContextoIA } from '../../core/ia/porta-ia.js'
import { compilarDnaContato } from '../contatos/contato.dna.js'
import { compilarDnaComCamadas } from '../tenant/tenant.dna.js'
import { lerEstilo, regrasDeEstilo, type EstiloConversa } from '../tenant/tenant.estilo.js'
import { lerRoteiro, lerEstado, instrucaoRoteiro } from '../roteiro/roteiro.dominio.js'

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
  dnaRegras?: string | null // Regras de Negócio do DNA — invioláveis, prioridade máxima
  estilo: EstiloConversa // controles estruturados de COMO ESCREVER (formalidade/emoji/bolhas…)
  saudacao?: string | null // diretriz de saudação (horário + "já falou antes") — o "não parecer robô"
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
  // SAUDAÇÃO (o "não parecer robô", pedido do parceiro): horário certo + não recomeçar com
  // "bom dia/meu nome é" se já houve conversa. Alta saliência: entra logo no comportamento.
  if (m.saudacao?.trim()) linhas.push(m.saudacao.trim())
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
  // ── Regras de negócio do DNA (definidas pelo cliente) — vencem a IDENTIDADE/persona, mas
  // NUNCA o guardrail anti-invenção acima (o cliente é semi-confiável: uma regra descuidada
  // não pode autorizar a IA a inventar preço/fato). Ordem: anti-alucinação > regras > persona.
  if (m.dnaRegras?.trim())
    linhas.push(
      'REGRAS DE NEGÓCIO DA EMPRESA (definidas pela empresa — têm prioridade sobre a IDENTIDADE/persona e o estilo; mas NÃO autorizam afirmar preços, prazos ou fatos fora das fontes autorizadas — o guardrail anti-invenção acima continua valendo por cima): ' +
        m.dnaRegras.trim(),
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
  dna?: unknown // camada de DNA DESTA missão (#9 Fase C): vence a campanha e o tenant
  estilo?: unknown // perfil de conversa DESTA missão (tem prioridade sobre o do tenant)
  estado: EstadoMissao
  resumo: string | null
  fatos: unknown
  contato?: {
    memoria: unknown
    dna?: unknown // DNA do contato (perfil/comunicação/histórico/observações)
    tags?: { tag: { nome: string; descricao: string | null } }[]
  } | null
  // identidade (voz) + estilo (fallback) + DNA (conhecimento categorizado) da IA
  tenant?: { persona: string | null; estilo?: unknown; dna?: unknown } | null
  // camada de DNA da campanha (#9 Fase B): sobrescreve categorias do tenant (Substituir/Combinar)
  // + roteiro (§FactoryHub): sequência guiada herdada AO VIVO pela missão
  campanha?: { dna?: unknown; roteiro?: unknown } | null
  roteiroEstado?: unknown // progresso desta missão no roteiro (null = fora de roteiro / conversa livre)
  mensagens: { direcao: Direcao; conteudo: string }[]
}

// Sinais de "conversa humana" calculados fora do domínio (dependem de hora/DB) e injetados aqui.
export type SinaisConversa = {
  periodo?: 'manhã' | 'tarde' | 'noite' | null // período do dia no fuso do tenant (saudação certa)
  jaConversouAntes?: boolean // já houve troca com este contato (nesta ou em missão anterior)
}

// Monta a diretriz de saudação a partir dos sinais. Regra do parceiro: saudar conforme o horário e
// NÃO recomeçar com "bom dia/olá/meu nome é" quando já se conversou com a pessoa.
function montarSaudacao(sinais?: SinaisConversa): string | null {
  if (!sinais) return null
  const partes: string[] = []
  if (sinais.jaConversouAntes) {
    partes.push(
      'CONTINUIDADE: você JÁ conversou com este contato antes — NÃO recomece com saudação nem se ' +
        'apresente de novo (nada de "bom dia", "olá", "meu nome é…"); retome direto o assunto, com ' +
        'naturalidade, como quem dá seguimento a uma conversa já em andamento.',
    )
  } else if (sinais.periodo) {
    partes.push(
      `Agora é de ${sinais.periodo} (horário de Brasília): se for cumprimentar, use a saudação ` +
        `compatível com o horário (bom dia / boa tarde / boa noite) — nunca a errada. Cumprimente ` +
        `no MÁXIMO uma vez, no começo.`,
    )
  }
  return partes.length ? partes.join(' ') : null
}

export function montarFicha(
  missao: MissaoComMsgs,
  conhecimento?: string[] | null,
  midiasDisponiveis?: { id: string; nome: string }[] | null,
  sinais?: SinaisConversa,
): ContextoIA {
  // DNA hierárquico (#9): tenant = base; campanha e missão são camadas em ordem CRESCENTE de
  // prioridade (a missão vence a campanha, que vence o tenant). Substituir/Combinar por categoria.
  const dna = compilarDnaComCamadas(missao.tenant?.dna, missao.campanha?.dna, missao.dna)
  // MODO ROTEIRO (§FactoryHub): se a campanha tem roteiro, resolve o passo atual desta missão e
  // injeta a instrução no contexto. Sem roteiro → null (conversa livre, comportamento intocado).
  const roteiro = lerRoteiro(missao.campanha?.roteiro)
  const roteiroInstrucao = roteiro ? instrucaoRoteiro(roteiro, lerEstado(missao.roteiroEstado)) : null
  return {
    persona: montarPersona({
      tipo: missao.tipo,
      objetivo: missao.objetivo,
      contexto: missao.contexto,
      tom: missao.tom,
      criterioConclusao: missao.criterioConclusao,
      personaTenant: missao.tenant?.persona,
      dnaRegras: dna.regras,
      // perfil da missão vence; sem ele, herda o padrão do tenant (fallback)
      estilo: lerEstilo(missao.estilo ?? missao.tenant?.estilo),
      saudacao: montarSaudacao(sinais),
    }),
    objetivo: missao.objetivo,
    contexto: missao.contexto,
    informacoes: missao.informacoes,
    estadoAtual: missao.estado,
    resumo: missao.resumo,
    fatos: (missao.fatos as Record<string, unknown> | null) ?? {},
    memoriaContato:
      (missao.contato?.memoria as Record<string, unknown> | null) ?? null,
    // TAGS com descrição viram características do contato (só as que carregam conhecimento).
    // Orçamento de contexto: no máx. 10 tags e ~400 chars cada (não infla o prompt a cada turno).
    caracteristicasContato:
      missao.contato?.tags
        ?.map((t) => t.tag)
        .filter((t) => t.descricao?.trim())
        .slice(0, 10)
        .map((t) => `${t.nome}: ${t.descricao!.trim().slice(0, 400)}`) ?? null,
    // DNA do contato: personalização sobre a pessoa (não é fonte de fato)
    dnaContato: compilarDnaContato(missao.contato?.dna),
    conhecimento: conhecimento ?? null,
    dnaConhecimento: dna.conhecimento,
    roteiro: roteiroInstrucao,
    midiasDisponiveis: midiasDisponiveis ?? null,
    ultimasMensagens: missao.mensagens
      .slice(-ULTIMAS)
      .map((m) => ({ direcao: m.direcao, conteudo: m.conteudo })),
  }
}
