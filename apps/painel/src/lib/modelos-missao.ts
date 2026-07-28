import { PERFIS } from './estilos-conversa'
import type { EstiloConversa, ModoMissao, TipoMissao } from './types'

// Modelo de missão = ponto de partida pronto pro builder visual.
// Um não-dev escolhe o objetivo pela linguagem do dia a dia; os campos técnicos
// (objetivo, tom, critério, modo) já vêm preenchidos com um bom padrão — e editáveis.
// Cada modelo também traz um PERFIL DE CONVERSA (estilo) embutido — o "jeito de falar"
// do papel; vem junto ao escolher o modelo e o usuário ajusta → personalizado (salvo na missão).
export interface ModeloMissao {
  id: string
  tipo: TipoMissao
  emoji: string
  titulo: string
  resumo: string
  objetivo: string
  tom: string
  criterioConclusao: string
  /** dica do que preencher em "informações autorizadas" */
  informacoesDica: string
  modo: ModoMissao
  /** perfil de conversa embutido (formalidade/emoji/bolhas…) */
  estilo: EstiloConversa
}

export const MODELOS: ModeloMissao[] = [
  {
    id: 'prospeccao',
    tipo: 'vender',
    emoji: '🚀',
    titulo: 'Prospecção (lead novo)',
    resumo: 'Apresenta a solução pra quem ainda não conhece e desperta interesse.',
    objetivo:
      'Iniciar o contato de forma calorosa, apresentar brevemente a solução e despertar interesse, conduzindo para uma conversa ou demonstração.',
    tom: 'Amigável, consultivo e leve — sem pressão.',
    criterioConclusao: 'Lead demonstrou interesse claro ou aceitou uma conversa/demonstração.',
    informacoesDica: 'O que sua empresa faz, para quem, e o diferencial. Preços só se puder afirmar.',
    modo: 'auto',
    estilo: PERFIS.vendedor,
  },
  {
    id: 'followup',
    tipo: 'vender',
    emoji: '📩',
    titulo: 'Follow-up de proposta',
    resumo: 'Retoma quem recebeu uma proposta e ainda não respondeu.',
    objetivo:
      'Retomar o contato com quem já recebeu uma proposta, entender se há dúvidas ou objeções e ajudar a avançar para o fechamento.',
    tom: 'Cordial e prestativo, sem parecer cobrança.',
    criterioConclusao: 'Proposta aceita, reunião marcada, ou objeção resolvida/encaminhada.',
    informacoesDica: 'Resumo da proposta enviada, valores e condições que você pode confirmar.',
    modo: 'auto',
    estilo: PERFIS.vendedorConsultivo,
  },
  {
    id: 'qualificacao',
    tipo: 'qualificar',
    emoji: '🔍',
    titulo: 'Qualificação de lead',
    resumo: 'Entende necessidade, orçamento e urgência antes de passar pro vendedor.',
    objetivo:
      'Entender a necessidade do lead, o contexto, o orçamento aproximado e a urgência, para qualificar e encaminhar ao time certo.',
    tom: 'Curioso e acolhedor, fazendo boas perguntas.',
    criterioConclusao: 'Lead qualificado com necessidade, orçamento e urgência entendidos.',
    informacoesDica: 'Faixas de atendimento, tipos de cliente ideais e o que caracteriza um bom lead.',
    modo: 'auto',
    estilo: PERFIS.qualificacao,
  },
  {
    id: 'orcamento',
    tipo: 'orcar',
    emoji: '🧾',
    titulo: 'Levantar orçamento',
    resumo: 'Coleta o que a pessoa precisa pra montar um orçamento.',
    objetivo:
      'Levantar os detalhes necessários (o que precisa, quantidade, prazo, especificações) para preparar um orçamento preciso.',
    tom: 'Objetivo e organizado, confirmando cada detalhe.',
    criterioConclusao: 'Todos os dados para o orçamento foram coletados.',
    informacoesDica: 'Itens/serviços que você oferece e quais informações são obrigatórias pra orçar.',
    modo: 'auto',
    estilo: PERFIS.orcamento,
  },
  {
    id: 'cobranca',
    tipo: 'cobrar',
    emoji: '⏰',
    titulo: 'Cobrança amigável',
    resumo: 'Lembra de um pagamento em aberto com cordialidade.',
    objetivo:
      'Lembrar o contato de um pagamento em aberto de forma respeitosa, confirmar a situação e oferecer o caminho para regularizar.',
    tom: 'Respeitoso, empático e firme na medida certa.',
    criterioConclusao: 'Pagamento confirmado ou acordo/prazo combinado.',
    informacoesDica: 'Valor, vencimento, formas de pagamento e link/chave que você pode informar.',
    modo: 'copilot',
    estilo: PERFIS.cobranca,
  },
  {
    id: 'suporte',
    tipo: 'suporte',
    emoji: '🛟',
    titulo: 'Suporte / dúvidas',
    resumo: 'Responde dúvidas comuns e resolve ou escala pro humano.',
    objetivo:
      'Atender dúvidas do contato, resolver o que for possível com as informações autorizadas e escalar para um humano quando necessário.',
    tom: 'Prestativo, paciente e claro.',
    criterioConclusao: 'Dúvida resolvida ou encaminhada ao time responsável.',
    informacoesDica: 'FAQ, políticas, prazos e procedimentos que a IA pode informar com segurança.',
    modo: 'auto',
    estilo: PERFIS.suporte,
  },
  {
    id: 'reativacao',
    tipo: 'vender',
    emoji: '💫',
    titulo: 'Reativação de cliente',
    resumo: 'Reengaja um cliente inativo com uma novidade ou oferta.',
    objetivo:
      'Reconectar com um cliente que ficou inativo, relembrar o valor da solução e apresentar uma novidade ou condição especial para reativar.',
    tom: 'Caloroso e próximo, como quem retoma uma boa relação.',
    criterioConclusao: 'Cliente reengajado (respondeu com interesse) ou reativou.',
    informacoesDica: 'A novidade/oferta que pode ser oferecida e condições que você pode confirmar.',
    modo: 'auto',
    estilo: PERFIS.vendedor,
  },
  {
    id: 'zero',
    tipo: 'outro',
    emoji: '✏️',
    titulo: 'Começar do zero',
    resumo: 'Monte a missão do seu jeito, campo a campo.',
    objetivo: '',
    tom: '',
    criterioConclusao: '',
    informacoesDica: 'Preços, prazos e condições REAIS que a IA pode afirmar.',
    modo: 'auto',
    estilo: PERFIS.padrao,
  },
]
