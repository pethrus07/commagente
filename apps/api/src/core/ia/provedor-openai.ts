// 🔌 Provedor de IA real — OpenAI (chat completions + JSON mode).
// Implementa a mesma PortaIA do dublê; troca via IA_PROVIDER=openai.
import { config } from '../config'
import type { ContextoIA, ProvedorIA, SaidaIA } from './porta-ia'
import { SaidaIASchema } from './porta-ia'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

async function chat(
  messages: Msg[],
  opts: Record<string, unknown> = {},
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({ model: config.openaiModelo, messages, ...opts }),
    // não pendura o turno (nem o lock da missão) indefinidamente se a OpenAI travar
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return j.choices?.[0]?.message?.content ?? ''
}

// renderiza as últimas mensagens como diálogo
function historico(ctx: ContextoIA): string {
  return ctx.ultimasMensagens
    .map((m) => `${m.direcao === 'in' ? 'Lead' : 'Você'}: ${m.conteudo}`)
    .join('\n')
}

const ESTADOS_SAIDA =
  'em_conversa | concluida | descartada | escalada | sem_resposta'

export const provedorOpenai: ProvedorIA = {
  nome: 'openai',

  async gerar(ctx): Promise<SaidaIA> {
    const fatos =
      ctx.fatos && Object.keys(ctx.fatos).length > 0
        ? `DADOS JÁ COLETADOS deste lead (NÃO peça de novo o que já está aqui — use e pergunte SÓ o que falta): ${JSON.stringify(ctx.fatos)}.`
        : ''
    // Memória INDIVIDUAL do contato (o que já sabemos dele de interações anteriores)
    const memoria =
      ctx.memoriaContato && Object.keys(ctx.memoriaContato).length > 0
        ? `Memória deste contato (de conversas anteriores — use para personalizar): ${JSON.stringify(ctx.memoriaContato)}.`
        : ''
    // Memória COLETIVA do tenant (conhecimento aprendido/curado)
    const conhecimento =
      ctx.conhecimento && ctx.conhecimento.length > 0
        ? `BASE DE CONHECIMENTO da empresa (aprendida com atendimentos anteriores — use quando ajudar; conta como fonte autorizada junto com as INFORMAÇÕES AUTORIZADAS):\n- ${ctx.conhecimento.join('\n- ')}`
        : ''
    // Bloco de informações AUTORIZADAS (guardrail): é o único que pode virar afirmação.
    const informacoes = ctx.informacoes?.trim()
      ? `INFORMAÇÕES AUTORIZADAS (a ÚNICA fonte de fatos que você pode afirmar sobre a empresa/oferta):\n${ctx.informacoes.trim()}`
      : 'INFORMAÇÕES AUTORIZADAS: nenhuma foi fornecida. Portanto NÃO afirme NENHUM fato sobre a empresa/oferta — se perguntarem qualquer coisa, diga que vai confirmar e retornar, ou escale (precisa_humano=true).'
    const sistema = [
      ctx.persona,
      `Estado atual da missão: ${ctx.estadoAtual}.`,
      ctx.resumo ? `Resumo da conversa até aqui: ${ctx.resumo}.` : '',
      fatos,
      memoria,
      conhecimento,
      informacoes,
      'REGRA CRÍTICA (anti-alucinação): só afirme informações que estejam EXPLICITAMENTE nas INFORMAÇÕES AUTORIZADAS ou na BASE DE CONHECIMENTO acima. Para QUALQUER detalhe que não esteja lá — preço, política de quartos, tamanhos/medidas, formas de pagamento, datas específicas, disponibilidade, qualquer condição operacional — NÃO invente e NÃO improvise. O PADRÃO nesses casos é RESPONDER de forma natural que você vai confirmar esse detalhe com a equipe e já retorna, e SEGUIR conduzindo a conversa rumo ao objetivo (precisa_humano=FALSE). Use precisa_humano=true SOMENTE quando um humano realmente precisa agir/decidir — ex.: negociar preço ou condição, reclamação, pedido fora do escopo da missão — NÃO para toda pergunta cuja resposta você não tem. Nunca pause a missão só porque falta um dado informativo; apenas diga que confirma e continue.',
      'Responda SOMENTE em JSON válido, sem markdown, no formato exato:',
      `{"resposta": "texto curto e humano (1-3 frases, WhatsApp)", "novo_estado": "${ESTADOS_SAIDA}", "categoria": "string ou null", "fatos_novos": {objeto com o que você descobriu SOBRE ESTE LEAD, ou {}}, "precisa_humano": true|false, "motivo_escala": "string ou null", "aprendizado_sugerido": "uma lição GERAL e reutilizável p/ atendimentos futuros da empresa (NÃO dados de um lead), ou null", "resultado": "SÓ ao concluir a missão (novo_estado=concluida): resumo curto do desfecho (ex.: 'reunião agendada quinta 15h', 'pagamento confirmado'); senão null"}`,
      'Conduza a conversa rumo ao objetivo, com naturalidade. Se o lead pedir algo que você não pode resolver, use precisa_humano=true.',
      'aprendizado_sugerido: só preencha se surgiu algo claramente generalizável e útil p/ a empresa (ex.: uma objeção comum e como contorná-la); senão null. Nunca invente.',
    ]
      .filter(Boolean)
      .join('\n')

    const usuario =
      historico(ctx) ||
      '(a conversa ainda não começou — escreva a PRIMEIRA mensagem para iniciar o contato de forma calorosa, curta e natural, e TERMINE com uma pergunta ou convite claro pra pessoa responder — isso aumenta a taxa de resposta e evita bloqueio)'

    const raw = await chat(
      [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      { response_format: { type: 'json_object' }, temperature: 0.7 },
    )

    try {
      return SaidaIASchema.parse(JSON.parse(raw))
    } catch {
      // fallback resiliente: nunca trava o harness
      return {
        resposta:
          'Opa, deixa eu te entender melhor — pode me contar um pouco mais?',
        novo_estado: 'em_conversa',
        categoria: null,
        fatos_novos: {},
        precisa_humano: false,
        motivo_escala: null,
        aprendizado_sugerido: null,
        resultado: null,
      }
    }
  },

  async resumir(ctx): Promise<string> {
    const raw = await chat(
      [
        {
          role: 'system',
          content:
            'Resuma a conversa em 1-2 frases objetivas (estágio, interesse e fatos-chave do lead). Responda só o resumo, sem preâmbulo.',
        },
        {
          role: 'user',
          content: `Objetivo: ${ctx.objetivo}\nResumo anterior: ${
            ctx.resumo ?? '(nenhum)'
          }\nMensagens:\n${historico(ctx)}`,
        },
      ],
      { temperature: 0.3 },
    )
    return raw.trim()
  },
}
