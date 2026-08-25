// 🔌 Provedor de IA real — OpenAI (chat completions + JSON mode).
// Implementa a mesma PortaIA do dublê; troca via IA_PROVIDER=openai.
import { config } from '../config'
import type { ContextoIA, DadosAnalise, ProvedorIA, SaidaIA, UsoIA } from './porta-ia'
import { SaidaIASchema } from './porta-ia'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

async function chat(
  messages: Msg[],
  opts: Record<string, unknown> = {},
): Promise<{ conteudo: string; uso: UsoIA }> {
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
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    conteudo: j.choices?.[0]?.message?.content ?? '',
    uso: {
      entrada: j.usage?.prompt_tokens ?? 0,
      saida: j.usage?.completion_tokens ?? 0,
    },
  }
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

  async gerar(ctx): Promise<{ saida: SaidaIA; uso?: UsoIA }> {
    const fatos =
      ctx.fatos && Object.keys(ctx.fatos).length > 0
        ? `DADOS JÁ COLETADOS deste lead (NÃO peça de novo o que já está aqui — use e pergunte SÓ o que falta): ${JSON.stringify(ctx.fatos)}.`
        : ''
    // Memória INDIVIDUAL do contato (o que já sabemos dele de interações anteriores)
    const memoria =
      ctx.memoriaContato && Object.keys(ctx.memoriaContato).length > 0
        ? `Memória deste contato (de conversas anteriores — use para personalizar): ${JSON.stringify(ctx.memoriaContato)}.`
        : ''
    // Características do contato vindas das TAGS (camada complementar sobre a pessoa)
    const caracteristicas =
      ctx.caracteristicasContato && ctx.caracteristicasContato.length > 0
        ? `CARACTERÍSTICAS deste contato (tags — considere na abordagem; é conhecimento SOBRE A PESSOA, não autoriza inventar preço/fato):\n- ${ctx.caracteristicasContato.join('\n- ')}`
        : ''
    // DNA DESTE CONTATO (perfil/comunicação/histórico/observações) — personalização sobre a pessoa
    const dnaContato = ctx.dnaContato?.trim()
      ? `DNA DESTE CONTATO (o que sabemos sobre a pessoa — use pra PERSONALIZAR a abordagem e o tom; é conhecimento SOBRE A PESSOA, NÃO autoriza inventar preço/fato):\n${ctx.dnaContato.trim()}`
      : ''
    // Memória COLETIVA do tenant (conhecimento aprendido/curado)
    const conhecimento =
      ctx.conhecimento && ctx.conhecimento.length > 0
        ? `BASE DE CONHECIMENTO da empresa (aprendida com atendimentos anteriores — use quando ajudar; conta como fonte autorizada junto com as INFORMAÇÕES AUTORIZADAS):\n- ${ctx.conhecimento.join('\n- ')}`
        : ''
    // DNA da empresa (conhecimento estruturado por categorias definido pelo cliente)
    const dna = ctx.dnaConhecimento?.trim()
      ? `DNA DA EMPRESA (conhecimento estruturado sobre a empresa — use quando ajudar; conta como fonte autorizada junto com as INFORMAÇÕES AUTORIZADAS):\n${ctx.dnaConhecimento.trim()}`
      : ''
    // Biblioteca de mídia: arquivos que a IA pode ENVIAR (via enviar_midia) no momento certo
    const midias =
      ctx.midiasDisponiveis && ctx.midiasDisponiveis.length > 0
        ? `MÍDIAS QUE VOCÊ PODE ENVIAR (catálogo, tabela de preço, PDF etc. — envie preenchendo "enviar_midia" com o id, SÓ quando o lead demonstrar interesse claro ou pedir; nunca logo de cara e nunca repita a mesma pro mesmo contato):\n${ctx.midiasDisponiveis.map((m) => `- id ${m.id}: ${m.nome}`).join('\n')}`
        : ''
    // MODO ROTEIRO (§FactoryHub): o sistema já escolheu o passo; a IA só o executa com a própria voz.
    // Vai ao FIM do prompt (recência = máxima saliência) — é o comando que rege ESTE turno.
    const roteiro = ctx.roteiro?.instrucao
      ? [
          '━━━ ROTEIRO GUIADO — seu COMANDO PRINCIPAL neste turno ━━━',
          'Esta conversa segue um ROTEIRO definido pela empresa. Você NÃO escolhe a próxima pergunta: o sistema já escolheu. Sua função é conduzir SÓ o passo abaixo, com a sua voz e o seu estilo, e extrair o que for pedido.',
          `PASSO ATUAL → ${ctx.roteiro.instrucao}`,
          'Faça SOMENTE este passo agora — não adiante os próximos passos, não repita os anteriores e não invente perguntas fora do roteiro.',
          'Se o cliente DESVIAR (dúvida, pergunta ou objeção), responda com naturalidade usando o conhecimento da empresa acima e, na MESMA mensagem, retome educadamente este passo. Nunca pule o passo por causa do desvio e nunca reinicie o roteiro do zero.',
          ctx.roteiro.menu?.length
            ? `LEMBRETE (menu): se o cliente indicou uma escolha, sua saída DEVE trazer "opcao_roteiro" com um destes rótulos: ${ctx.roteiro.menu.join(' / ')} — e essa escolha NÃO vai em fatos_novos.`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : ''
    // Bloco de informações AUTORIZADAS (guardrail). Fontes autorizadas = estas + DNA + base de
    // conhecimento. Sem informações por-missão, mas COM DNA/base, elas ainda são fonte válida —
    // não negue tudo (senão a IA se recusaria a usar o DNA que o cliente preencheu).
    const temOutraFonte = !!ctx.dnaConhecimento?.trim() || (ctx.conhecimento?.length ?? 0) > 0
    const informacoes = ctx.informacoes?.trim()
      ? `INFORMAÇÕES AUTORIZADAS (fonte de fatos que você pode afirmar sobre a empresa/oferta — junto com o DNA DA EMPRESA e a BASE DE CONHECIMENTO):\n${ctx.informacoes.trim()}`
      : temOutraFonte
        ? 'INFORMAÇÕES AUTORIZADAS: nenhuma específica desta missão — use o DNA DA EMPRESA e a BASE DE CONHECIMENTO acima como fonte de fatos. Para o que não estiver em NENHUMA dessas fontes, não invente: diga que vai confirmar e retornar, ou escale.'
        : 'INFORMAÇÕES AUTORIZADAS: nenhuma foi fornecida. Portanto NÃO afirme NENHUM fato sobre a empresa/oferta — se perguntarem qualquer coisa, diga que vai confirmar e retornar, ou escale (precisa_humano=true).'
    const sistema = [
      ctx.persona,
      `Estado atual da missão: ${ctx.estadoAtual}.`,
      ctx.resumo ? `Resumo da conversa até aqui: ${ctx.resumo}.` : '',
      fatos,
      memoria,
      caracteristicas,
      dnaContato,
      conhecimento,
      dna,
      midias,
      informacoes,
      'REGRA CRÍTICA (anti-alucinação): só afirme informações que estejam EXPLICITAMENTE nas INFORMAÇÕES AUTORIZADAS, na BASE DE CONHECIMENTO ou no DNA DA EMPRESA acima. Para QUALQUER detalhe que não esteja lá — preço, política de quartos, tamanhos/medidas, formas de pagamento, datas específicas, disponibilidade, qualquer condição operacional — NÃO invente e NÃO improvise. O PADRÃO nesses casos é RESPONDER de forma natural que você vai confirmar esse detalhe com a equipe e já retorna, e SEGUIR conduzindo a conversa rumo ao objetivo (precisa_humano=FALSE). Use precisa_humano=true SOMENTE quando um humano realmente precisa agir/decidir — ex.: negociar preço ou condição, reclamação, pedido fora do escopo da missão — NÃO para toda pergunta cuja resposta você não tem. Nunca pause a missão só porque falta um dado informativo; apenas diga que confirma e continue.',
      roteiro,
      'Responda SOMENTE em JSON válido, sem markdown, no formato exato:',
      `{"resposta": "texto curto e humano no estilo pedido (WhatsApp); se o COMO ESCREVER pedir várias mensagens, coloque cada uma numa linha separada com \\n dentro deste mesmo campo", "novo_estado": "${ESTADOS_SAIDA}", "categoria": "string ou null", "fatos_novos": {objeto com o que você descobriu SOBRE ESTE LEAD, ou {}}, "precisa_humano": true|false, "motivo_escala": "string ou null", "aprendizado_sugerido": "uma lição GERAL e reutilizável p/ atendimentos futuros da empresa (NÃO dados de um lead), ou null", "enviar_midia": "id de uma MÍDIA da lista acima pra mandar AGORA (só quando fizer sentido), ou null", "opcao_roteiro": "no ROTEIRO GUIADO, quando o passo atual for de MENU, o rótulo EXATO que o cliente escolheu; senão null", "resultado": "SÓ ao concluir a missão (novo_estado=concluida): resumo curto do desfecho (ex.: 'reunião agendada quinta 15h', 'pagamento confirmado'); senão null"}`,
      'Conduza a conversa rumo ao objetivo, com naturalidade. Se o lead pedir algo que você não pode resolver, use precisa_humano=true.',
      'aprendizado_sugerido: só preencha se surgiu algo claramente generalizável e útil p/ a empresa (ex.: uma objeção comum e como contorná-la); senão null. Nunca invente.',
    ]
      .filter(Boolean)
      .join('\n')

    const usuario =
      historico(ctx) ||
      '(a conversa ainda não começou — escreva a abertura do contato de forma calorosa e natural, seguindo o estilo pedido em COMO ESCREVER, e TERMINE com uma pergunta ou convite claro pra pessoa responder — isso aumenta a taxa de resposta e evita bloqueio)'

    const { conteudo: raw, uso } = await chat(
      [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      { response_format: { type: 'json_object' }, temperature: 0.7 },
    )

    try {
      return { saida: SaidaIASchema.parse(JSON.parse(raw)), uso }
    } catch {
      // fallback resiliente: nunca trava o harness
      return {
        uso,
        saida: {
          resposta:
            'Opa, deixa eu te entender melhor — pode me contar um pouco mais?',
          novo_estado: 'em_conversa',
          categoria: null,
          fatos_novos: {},
          precisa_humano: false,
          motivo_escala: null,
          aprendizado_sugerido: null,
          resultado: null,
        },
      }
    }
  },

  async resumir(ctx): Promise<{ texto: string; uso?: UsoIA }> {
    const { conteudo: raw, uso } = await chat(
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
    return { texto: raw.trim(), uso }
  },

  async sintetizar(dados): Promise<{ texto: string; uso?: UsoIA }> {
    // amostra as conversas (cap pra não estourar o contexto em campanhas grandes)
    const amostra = dados.linhas
      .slice(0, 120)
      .map((l) => {
        const p = [`- ${l.contato} [${l.estado}]`]
        if (l.resultado) p.push(`desfecho: ${l.resultado}`)
        if (l.resumo) p.push(`resumo: ${l.resumo}`)
        if (l.fatos && Object.keys(l.fatos).length) p.push(`dados: ${JSON.stringify(l.fatos)}`)
        return p.join(' · ')
      })
      .join('\n')
    const { conteudo, uso } = await chat(
      [
        {
          role: 'system',
          content:
            'Você é um analista. A partir das conversas de uma campanha de WhatsApp (cada linha = um contato), escreva um RELATÓRIO GERENCIAL curto e direto em português-BR, em markdown com bullets: (1) **Visão geral** — quantos responderam/converteram/escalaram; (2) **Principais achados** — padrões e informações recorrentes coletadas; (3) **Pontos de atenção e próximos passos**. Seja concreto e cite números. NÃO invente nada que não esteja nas conversas; se um dado não aparece, diga que não foi coletado.',
        },
        {
          role: 'user',
          content: `Objetivo da campanha: ${dados.objetivo}\nTipo: ${dados.tipo}\nTotal de contatos: ${dados.total}\n\nConversas:\n${amostra || '(nenhuma conversa com conteúdo ainda)'}`,
        },
      ],
      { temperature: 0.4 },
    )
    return { texto: conteudo.trim(), uso }
  },

  async analisar(dados: DadosAnalise): Promise<{ texto: string; uso?: UsoIA }> {
    // Central de Inteligência (#7): responde SÓ com base no snapshot — guardrail anti-invenção.
    const { conteudo, uso } = await chat(
      [
        {
          role: 'system',
          content:
            'Você é o analista de dados desta conta de atendimento por WhatsApp com IA. Responda à pergunta do operador USANDO SOMENTE os dados (JSON) fornecidos como fonte da verdade. REGRAS: (1) nunca invente números, nomes, datas ou fatos — se a resposta não estiver nos dados, diga com clareza que esse dado ainda não está disponível; (2) use os números EXATOS dos dados; (3) responda em português-BR, direto e objetivo, em markdown curto quando ajudar (negrito/listas); (4) não exponha IDs internos nem devolva o JSON cru; (5) se a pergunta fugir dos dados da conta, explique gentilmente o que você consegue responder.',
        },
        {
          role: 'user',
          content: `DADOS (retrato atual da conta):\n${JSON.stringify(dados.snapshot)}\n\nPERGUNTA: ${dados.pergunta}`,
        },
      ],
      { temperature: 0.2 },
    )
    return { texto: conteudo.trim(), uso }
  },
}
