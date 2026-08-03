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

export type RecorrenciaAgendamento = 'uma_vez' | 'mensal'
export type EntregaAgendamento = 'ia' | 'fixa'

export interface Agendamento {
  id: string
  tipo: string
  modo: string
  objetivo: string
  recorrencia: RecorrenciaAgendamento
  diaDoMes: number | null
  dataUnica: string | null
  entrega: EntregaAgendamento
  mensagemFixa: string | null
  rotulo: string | null
  ativo: boolean
  pularCicloRef: string | null
  ultimoCicloRef: string | null
  ultimoDisparoEm: string | null
  criadoEm: string
  contato: { nome: string | null; telefone: string; optOut: boolean }
  numero: { telefone: string }
}

export interface Numero {
  id: string
  telefone: string
  apelido: string | null
  instanciaEvolution: string
  statusConexao: StatusConexao
  aquecimentoEstagio: number
  budgetDiario: number
  tetoEfetivo: number
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
  avisarEscalonamento: boolean
  numeroAviso: string | null
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

export interface Tag {
  id: string
  nome: string
  cor: string | null
}

export interface TagResumo extends Tag {
  total: number
  criadoEm: string
}

export interface ContatoResumo {
  id: string
  nome: string | null
  telefone: string
  origem: string | null
  optOut: boolean
  criadoEm: string
  totalMissoes: number
  tags: Tag[]
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
  tokensEntrada: number
  tokensSaida: number
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
  alertas: { tipo: string; mensagem: string }[] // vigia: saúde/silêncio dos números
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
  pendentes: number // missões ainda paradas em 'configurada' (nunca disparadas)
}

// Resultado de um disparo em lote (iniciar campanha / iniciar todas as configuradas)
export interface ResultadoDisparo {
  iniciadas: number
  total: number
  puladas: Record<string, number>
}

// Relatório consolidado de uma campanha (conteúdo coletado por contato)
export interface RelatorioLinha {
  missaoId: string
  contato: string
  telefone: string
  estado: EstadoMissao
  resultado?: string | null
  resumo?: string | null
  fatos: Record<string, unknown>
}
export interface RelatorioCampanha {
  campanha: { id: string; nome: string; objetivo: string; tipo: TipoMissao; criadoEm: string }
  total: number
  concluidas: number
  escaladas: number
  porEstado: Record<string, number>
  camposFatos: string[]
  linhas: RelatorioLinha[]
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

// estilo de conversa da IA (controles estruturados de COMO ESCREVER — o "parecer humano")
export interface EstiloConversa {
  perfil?: string | null // rótulo do perfil de origem (Vendedor, Suporte…)
  formalidade: 'informal' | 'equilibrado' | 'formal'
  emoji: boolean
  abreviacoes: boolean
  travessaoProibido: boolean
  bolhas: boolean
}

// configuração do tenant atual — persona/identidade (voz da marca) + estilo de conversa (fallback)
export interface TenantConfig {
  id: string
  nome: string
  persona: string | null
  estilo: EstiloConversa
}
