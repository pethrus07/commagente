// 💛 Domínio (puro) — o "ESTILO DE CONVERSA" do tenant.
// Controles estruturados (formalidade, emoji, abreviação, travessão, bolhas) que viram
// REGRAS EXPLÍCITAS e de alta saliência no prompt — o que de fato faz a IA soar HUMANA.
// (Instrução enterrada em prosa o modelo ignora; regra direta e nomeada ele obedece.)
import { z } from 'zod'

export const estiloSchema = z.object({
  // rótulo do preset aplicado (só p/ a UI saber qual está ativo; não afeta o prompt)
  preset: z.string().max(60).nullish(),
  formalidade: z.enum(['informal', 'equilibrado', 'formal']).default('equilibrado'),
  emoji: z.enum(['nunca', 'raro', 'natural']).default('raro'),
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

  if (e.emoji === 'nunca') r.push('NÃO use emojis.')
  else if (e.emoji === 'raro') r.push('Use emoji com muita parcimônia (quase nenhum, e nunca logo na primeira mensagem).')
  else r.push('Pode usar emoji com naturalidade e sem exagero — só quando combinar com o clima da conversa, não em toda mensagem.')

  if (e.abreviacoes)
    r.push('Use o registro casual do WhatsApp: pode escrever em minúsculas e usar abreviações comuns (vc, pra, tá, né, hj, cê, blz) — sem exagerar a ponto de parecer descuidado.')
  else
    r.push('Escreva com português correto e pontuação adequada, sem abreviações de chat.')

  if (e.travessaoProibido)
    r.push('NUNCA use travessão (—) nem meia-risca (–): é a maior marca de texto de robô. No lugar, use vírgula, dois-pontos, reticências (...) ou simplesmente comece outra frase.')

  if (e.bolhas)
    r.push('FORMATO DA RESPOSTA: quebre em 2 ou 3 mensagens curtas, uma ideia por linha, SEPARADAS POR QUEBRA DE LINHA (dê Enter entre cada uma). Cada linha vira uma mensagem separada no WhatsApp — é assim que uma pessoa digita. Nada de um parágrafo único e longo.')
  else
    r.push('Responda em uma única mensagem curta (1 a 3 frases).')

  return (
    'COMO ESCREVER (estilo da conversa — SIGA À RISCA, é isto que faz soar humano; ' +
    'obs.: estilo NÃO autoriza afirmar preços/fatos fora das informações autorizadas): ' +
    r.join(' ')
  )
}
