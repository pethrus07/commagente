import type { EstiloConversa } from './types'

// Estilo padrão (espelha o ESTILO_PADRAO da API): mata o travessão de cara (ganho universal),
// mas mantém o resto conservador — quem quiser o "parecer humano" liga um preset.
export const ESTILO_PADRAO: EstiloConversa = {
  preset: null,
  formalidade: 'equilibrado',
  emoji: 'raro',
  abreviacoes: false,
  travessaoProibido: true,
  bolhas: false,
}

// Preset = ponto de partida pronto do estilo (+ uma persona sugerida). O tenant clica,
// ajusta os controles e a persona se quiser, e salva. Nada é aplicado até salvar.
export interface PresetEstilo {
  id: string
  emoji: string
  titulo: string
  resumo: string
  estilo: EstiloConversa
  personaSugerida: string
}

export const PRESETS_ESTILO: PresetEstilo[] = [
  {
    id: 'vendedor-humano',
    emoji: '🤝',
    titulo: 'Vendedor humano',
    resumo: 'Informal, direto, em bolhas curtas — igual gente de verdade no zap.',
    estilo: {
      preset: 'vendedor-humano',
      formalidade: 'informal',
      emoji: 'natural',
      abreviacoes: true,
      travessaoProibido: true,
      bolhas: true,
    },
    personaSugerida:
      'Você fala como um vendedor brasileiro de verdade no WhatsApp: gente boa, direto e sem enrolação. Puxa conversa, faz perguntas e conduz com leveza — nunca insiste nem parece robô.',
  },
  {
    id: 'atendimento-cordial',
    emoji: '💬',
    titulo: 'Atendimento cordial',
    resumo: 'Equilibrado e prestativo, uma mensagem por vez.',
    estilo: {
      preset: 'atendimento-cordial',
      formalidade: 'equilibrado',
      emoji: 'raro',
      abreviacoes: false,
      travessaoProibido: true,
      bolhas: false,
    },
    personaSugerida:
      'Você é o atendente da empresa: cordial, claro e prestativo. Resolve o que der com paciência e escala pra um humano quando precisa.',
  },
  {
    id: 'formal-corporativo',
    emoji: '🎩',
    titulo: 'Formal / corporativo',
    resumo: 'Profissional, sem gírias nem emoji.',
    estilo: {
      preset: 'formal-corporativo',
      formalidade: 'formal',
      emoji: 'nunca',
      abreviacoes: false,
      travessaoProibido: true,
      bolhas: false,
    },
    personaSugerida:
      'Você representa a empresa com formalidade e profissionalismo. Linguagem correta, respeitosa e objetiva, sem gírias.',
  },
  {
    id: 'descolado',
    emoji: '😎',
    titulo: 'Descolado / jovem',
    resumo: 'Leve, próximo, com emoji e bolhas.',
    estilo: {
      preset: 'descolado',
      formalidade: 'informal',
      emoji: 'natural',
      abreviacoes: true,
      travessaoProibido: true,
      bolhas: true,
    },
    personaSugerida:
      'Você fala de um jeito leve, jovem e próximo, tratando o cliente de igual pra igual. Descontraído, mas sempre prestativo e sem forçar.',
  },
]
