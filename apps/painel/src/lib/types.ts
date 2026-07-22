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
  criadoEm: string
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
  criadoEm: string
  totalMissoes: number
}

export interface Mensagem {
  id: string
  direcao: Direcao
  conteudo: string
  statusEnvio: StatusEnvio | null
  providerMsgId: string | null
  criadaEm: string
}

export interface Missao {
  id: string
  objetivo: string
  contexto: string | null
  tom: string | null
  informacoes: string | null
  estado: EstadoMissao
  iaPausada: boolean
  motivoEscala: string | null
  categoriaResultado: string | null
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
  totalMissoes: number
  totalContatos: number
  numeros: { total: number; conectados: number }
  mensagensHoje: number
}

export interface QrResposta {
  base64: string
  codigo?: string
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
