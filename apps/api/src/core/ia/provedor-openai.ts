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
        ? `Fatos já conhecidos do lead: ${JSON.stringify(ctx.fatos)}.`
        : ''
    const sistema = [
      ctx.persona,
      `Estado atual da missão: ${ctx.estadoAtual}.`,
      ctx.resumo ? `Resumo da conversa até aqui: ${ctx.resumo}.` : '',
      fatos,
      'Responda SOMENTE em JSON válido, sem markdown, no formato exato:',
      `{"resposta": "texto curto e humano (1-3 frases, WhatsApp)", "novo_estado": "${ESTADOS_SAIDA}", "categoria": "string ou null", "fatos_novos": {objeto com o que você descobriu, ou {}}, "precisa_humano": true|false, "motivo_escala": "string ou null"}`,
      'Conduza a conversa rumo ao objetivo, com naturalidade. Se o lead pedir algo que você não pode resolver, use precisa_humano=true.',
    ]
      .filter(Boolean)
      .join('\n')

    const usuario =
      historico(ctx) ||
      '(a conversa ainda não começou — escreva a PRIMEIRA mensagem para iniciar o contato de forma calorosa, curta e natural)'

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
