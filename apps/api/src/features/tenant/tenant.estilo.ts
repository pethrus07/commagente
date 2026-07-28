// 💛 Domínio (puro) — o "ESTILO DE CONVERSA" do tenant.
// Controles estruturados (formalidade, emoji, abreviação, travessão, bolhas) que viram
// REGRAS EXPLÍCITAS e de alta saliência no prompt — o que de fato faz a IA soar HUMANA.
// (Instrução enterrada em prosa o modelo ignora; regra direta e nomeada ele obedece.)
import { z } from 'zod'

export const estiloSchema = z.object({
  // rótulo do perfil de origem (só p/ a UI mostrar "Vendedor", "Suporte"…; não afeta o prompt)
  perfil: z.string().max(60).nullish(),
  formalidade: z.enum(['informal', 'equilibrado', 'formal']).default('equilibrado'),
  emoji: z.boolean().default(false), // usa emoji ou não (com moderação quando sim)
  abreviacoes: z.boolean().default(false),
  travessaoProibido: z.boolean().default(true), // matar o "—" é ganho universal (marca de robô)
  bolhas: z.boolean().default(false), // quebrar a resposta em 2-3 mensagens curtas (ritmo humano)
})
export type EstiloConversa = z.infer<typeof estiloSchema>

export const ESTILO_PADRAO: EstiloConversa = estiloSchema.parse({})

// coerção segura: aceita o Json cru do banco (ou null/lixo) e devolve um estilo COMPLETO.
export function lerEstilo(raw: unknown): EstiloConversa {
  const p = estiloSchema.safeParse(raw && typeof raw === 'object' ? raw : {})
  return p.success ? p.data : ESTILO_PADRAO
}

// renderiza os controles em regras de escrita para o prompt.
export function regrasDeEstilo(e: EstiloConversa): string {
  const r: string[] = []

  if (e.formalidade === 'informal')
    r.push('Fale de forma INFORMAL e próxima, como uma pessoa real conversando no WhatsApp — nada de tom corporativo ou robótico.')
  else if (e.formalidade === 'formal')
    r.push('Fale de forma PROFISSIONAL e educada, com português cuidado e sem gírias.')
  else
    r.push('Fale de forma cordial e natural: nem engessado, nem gíria demais.')

  if (e.emoji)
    r.push('Pode usar emoji, mas com MODERAÇÃO: no máximo um de vez em quando, quando combinar com o clima — nunca em toda mensagem e nunca logo na primeira.')
  else r.push('NÃO use emojis.')

  if (e.abreviacoes)
    r.push('Use o registro casual do WhatsApp: pode escrever em minúsculas e usar abreviações comuns (vc, pra, tá, né, hj, cê, blz) — sem exagerar a ponto de parecer descuidado.')
  else
    r.push('Escreva com português correto e pontuação adequada, sem abreviações de chat.')

  if (e.travessaoProibido)
    r.push('NUNCA use travessão (—) nem meia-risca (–): é a maior marca de texto de robô. No lugar, use vírgula, dois-pontos, reticências (...) ou simplesmente comece outra frase.')

  if (e.bolhas)
    r.push(
      'FORMATO DA RESPOSTA (REGRA OBRIGATÓRIA, vale MAIS que qualquer "1-3 frases"): NÃO escreva um parágrafo único. ' +
        'Quebre a resposta em 2 ou 3 mensagens BEM curtas e, no campo "resposta", separe CADA uma com uma quebra de linha real (o caractere \\n). ' +
        'Cada linha vira uma mensagem separada no WhatsApp — é assim que uma pessoa digita de verdade. ' +
        'Exemplo EXATO do valor de "resposta": "opa, tudo bem?\\ntô aqui pra te ajudar com o atendimento\\nposso te mostrar rapidinho como funciona?"',
    )
  else
    r.push('Responda em uma única mensagem curta (1 a 3 frases).')

  return (
    'COMO ESCREVER (estilo da conversa — SIGA À RISCA, é isto que faz soar humano; ' +
    'obs.: estilo NÃO autoriza afirmar preços/fatos fora das informações autorizadas): ' +
    r.join(' ')
  )
}
