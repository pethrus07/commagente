export type EstadoMissao =
  | 'configurada'
  | 'na_fila'
  | 'em_conversa'
  | 'concluida'
  | 'descartada'
  | 'escalada'
  | 'sem_resposta'
  | 'arquivada'

export type StatusConexao = 'desconectado' | 'conectando' | 'conectado'
export type Direcao = 'in' | 'out'
export type StatusEnvio = 'pendente' | 'enviando' | 'ok' | 'erro'

export type StatusSaude = 'saudavel' | 'atencao' | 'risco' | 'amostra_baixa'
export interface SaudeNumero {
  base: number
  respondidas: number
  naoRespondidas: number
  replyRate: number | null
  status: StatusSaude
}

export interface Numero {
  id: string
  telefone: string
  instanciaEvolution: string
  statusConexao: StatusConexao
  aquecimentoEstagio: number
  budgetDiario: number
  enviadosHoje: number
  maxConversasAtivas: number
  janelaInicio: string
  janelaFim: string
  suporteReativo: boolean
  suporteObjetivo: string | null
  suporteTom: string | null
  suporteInformacoes: string | null
  suporteCriterio: string | null
  suporteModo: string
  criadoEm: string
  saude?: SaudeNumero
}

export interface Contato {
  id: string
  telefone: string
  nome: string | null
  origem: string | null
  memoria?: Record<string, unknown> | null
}

export interface ContatoResumo {
  id: string
  nome: string | null
  telefone: string
  origem: string | null
  optOut: boolean
  criadoEm: string
  totalMissoes: number
}

export interface ImportResultado {
  criados: number
  atualizados: number
  ignorados: number
  total: number
}

export interface Mensagem {
  id: string
  direcao: Direcao
  conteudo: string
  statusEnvio: StatusEnvio | null
  providerMsgId: string | null
  criadaEm: string
}

export type TipoMissao = 'vender' | 'qualificar' | 'orcar' | 'cobrar' | 'suporte' | 'outro'
export type ModoMissao = 'auto' | 'copilot'

export interface Missao {
  id: string
  tipo: TipoMissao
  modo: ModoMissao
  rascunho: string | null
  objetivo: string
  contexto: string | null
  criterioConclusao: string | null
  tom: string | null
  informacoes: string | null
  estado: EstadoMissao
  iaPausada: boolean
  motivoEscala: string | null
  categoriaResultado: string | null
  resultado: string | null
  resumo: string | null
  fatos: Record<string, unknown> | null
  iniciadaEm: string | null
  concluidaEm: string | null
  criadoEm: string
  contato?: Contato
  numero?: Numero
  mensagens?: Mensagem[]
}

export interface Stats {
  missoesPorEstado: Partial<Record<EstadoMissao, number>>
  missoesPorTipo: Partial<Record<TipoMissao, number>>
  placar: {
    cumpridas: number
    perdidas: number
    ativas: number
    taxaConclusao: number | null
  }
  totalMissoes: number
  totalContatos: number
  numeros: { total: number; conectados: number }
  mensagensHoje: number
}

export interface QrResposta {
  base64: string
  codigo?: string
}

export interface HistoricoDia {
  data: string // YYYY-MM-DD
  missoes: number
  mensagens: number
  turnos: number
  escaladas: number
  concluidas: number
}
export interface Historico {
  dias: HistoricoDia[]
}

export type StatusConhecimento = 'sugerido' | 'aprovado' | 'rejeitado'

export interface Conhecimento {
  id: string
  titulo: string
  conteudo: string
  status: StatusConhecimento
  origem: string
  criadoEm: string
}

export interface CampanhaResumo {
  id: string
  nome: string
  tipo: TipoMissao
  objetivo: string
  numeroId: string
  criadoEm: string
  total: number
  cumpridas: number
}

export interface TenantResumo {
  id: string
  nome: string
  criadoEm: string
  totalMissoes: number
  totalNumeros: number
  totalContatos: number
  totalUsuarios: number
}
