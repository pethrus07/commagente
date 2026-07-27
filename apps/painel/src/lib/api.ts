import { auth, type UsuarioSessao } from './auth'
import type {
  Agendamento,
  CampanhaResumo,
  Conhecimento,
  ContatoResumo,
  EstadoMissao,
  Historico,
  ImportResultado,
  Missao,
  Numero,
  QrResposta,
  ResultadoDisparo,
  Stats,
  StatusConhecimento,
  Tag,
  TagResumo,
  TenantResumo,
} from './types'

const BASE = '/api' // proxy do Vite -> API Fastify (:3000)

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = auth.token()
  const tenant = auth.tenantSel() // super-admin visualizando um tenant
  const res = await fetch(BASE + path, {
    headers: {
      // só declara JSON quando há corpo — DELETE/GET sem body + content-type
      // faz o Fastify recusar (400 "body cannot be empty")
      ...(opts.body != null ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'x-tenant-id': tenant.id } : {}),
    },
    ...opts,
  })
  if (res.status === 401) {
    auth.sair() // token expirou/ inválido → derruba pra tela de login
    throw new Error('Sessão expirada — faça login novamente.')
  }
  const texto = await res.text()
  const dados = texto ? JSON.parse(texto) : null
  if (!res.ok) {
    const msg = dados?.erro ?? `${res.status} ${res.statusText}`
    throw new Error(typeof msg === 'string' ? msg : 'Erro na API')
  }
  return dados as T
}

export const api = {
  login: (email: string, senha: string) =>
    req<{ token: string; usuario: UsuarioSessao }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),

  admin: {
    tenants: () => req<TenantResumo[]>('/admin/tenants'),
    criarTenant: (data: { nome: string; adminEmail: string; adminSenha: string }) =>
      req<{ id: string; nome: string; adminEmail: string }>('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  stats: () => req<Stats>('/stats'),
  historico: (dias?: number) =>
    req<Historico>(`/stats/historico${dias ? `?dias=${dias}` : ''}`),

  numeros: {
    listar: () => req<Numero[]>('/numeros'),
    cadastrar: (telefone: string) =>
      req<Numero>('/numeros', {
        method: 'POST',
        body: JSON.stringify({ telefone }),
      }),
    conectar: (id: string) =>
      req<QrResposta>(`/numeros/${id}/conectar`, {
        method: 'POST',
        body: '{}',
      }),
    status: (id: string) =>
      req<{ status: Numero['statusConexao'] }>(`/numeros/${id}/status`),
    editar: (
      id: string,
      patch: {
        janelaInicio?: string
        janelaFim?: string
        budgetDiario?: number
        maxConversasAtivas?: number
        suporteReativo?: boolean
        suporteObjetivo?: string | null
        suporteTom?: string | null
        suporteInformacoes?: string | null
        suporteCriterio?: string | null
        suporteModo?: string
      },
    ) =>
      req<Numero>(`/numeros/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
  },

  escalados: () => req<Missao[]>('/escalados'),

  campanhas: {
    listar: () => req<CampanhaResumo[]>('/campanhas'),
    criar: (data: {
      nome: string
      numeroId: string
      tipo?: string
      modo?: string
      objetivo: string
      contexto?: string
      criterioConclusao?: string
      tom?: string
      informacoes?: string
      contatos?: { telefone: string; nome?: string }[]
      tagId?: string // dispara pra TODOS os contatos da tag (resolvido no servidor)
    }) => req<{ campanha: { id: string }; criadas: number }>('/campanhas', { method: 'POST', body: JSON.stringify(data) }),
    adicionarContatos: (
      id: string,
      alvo: { contatos?: { telefone: string; nome?: string }[]; tagId?: string },
    ) => req<{ criadas: number }>(`/campanhas/${id}/contatos`, { method: 'POST', body: JSON.stringify(alvo) }),
    iniciar: (id: string) =>
      req<ResultadoDisparo>(`/campanhas/${id}/iniciar`, { method: 'POST', body: '{}' }),
  },

  agendamentos: {
    listar: () => req<Agendamento[]>('/agendamentos'),
    criarLote: (data: {
      numeroId: string
      tipo?: string
      modo?: string
      objetivo?: string
      criterioConclusao?: string
      tom?: string
      informacoes?: string
      recorrencia: 'uma_vez' | 'mensal'
      diaDoMes?: number
      dataUnica?: string
      entrega: 'ia' | 'fixa'
      mensagemFixa?: string
      rotulo?: string
      contatos: { telefone: string; nome?: string; dia?: number }[]
    }) => req<{ criados: number; ignorados: number }>('/agendamentos/lote', { method: 'POST', body: JSON.stringify(data) }),
    editar: (id: string, patch: { diaDoMes?: number; ativo?: boolean; mensagemFixa?: string; objetivo?: string; tom?: string; informacoes?: string; rotulo?: string }) =>
      req<Agendamento>(`/agendamentos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    pular: (id: string) => req<Agendamento>(`/agendamentos/${id}/pular`, { method: 'POST', body: '{}' }),
    disparar: (id: string) => req(`/agendamentos/${id}/disparar`, { method: 'POST', body: '{}' }),
    remover: (id: string) => req(`/agendamentos/${id}`, { method: 'DELETE' }),
  },

  contatos: {
    listar: () => req<ContatoResumo[]>('/contatos'),
    criar: (data: { nome?: string; telefone: string }) =>
      req<ContatoResumo>('/contatos', { method: 'POST', body: JSON.stringify(data) }),
    importar: (contatos: { nome?: string; telefone: string }[]) =>
      req<ImportResultado>('/contatos/importar', {
        method: 'POST',
        body: JSON.stringify({ contatos }),
      }),
    importarWhatsApp: (numeroId: string) =>
      req<ImportResultado>('/contatos/importar-whatsapp', {
        method: 'POST',
        body: JSON.stringify({ numeroId }),
      }),
    exportarCSV: async (): Promise<string> => {
      const token = auth.token()
      const tenant = auth.tenantSel()
      const res = await fetch(BASE + '/contatos/exportar', {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(tenant ? { 'x-tenant-id': tenant.id } : {}),
        },
      })
      if (!res.ok) throw new Error('Falha ao exportar contatos.')
      return res.text()
    },
    aplicarTag: (contatoId: string, tagId: string) =>
      req(`/contatos/${contatoId}/tags`, { method: 'POST', body: JSON.stringify({ tagId }) }),
    removerTag: (contatoId: string, tagId: string) =>
      req(`/contatos/${contatoId}/tags/${tagId}`, { method: 'DELETE' }),
  },

  tags: {
    listar: () => req<TagResumo[]>('/tags'),
    criar: (data: { nome: string; cor?: string }) =>
      req<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    remover: (id: string) => req(`/tags/${id}`, { method: 'DELETE' }),
    aplicarEmLote: (id: string, contatoIds: string[]) =>
      req<{ aplicados: number }>(`/tags/${id}/contatos`, { method: 'POST', body: JSON.stringify({ contatoIds }) }),
  },

  conhecimento: {
    listar: () => req<Conhecimento[]>('/conhecimento'),
    criar: (data: { titulo: string; conteudo: string }) =>
      req<Conhecimento>('/conhecimento', { method: 'POST', body: JSON.stringify(data) }),
    importarDocumento: (data: { nomeArquivo: string; mimetype: string; base64: string }) =>
      req<Conhecimento>('/conhecimento/importar-documento', { method: 'POST', body: JSON.stringify(data) }),
    status: (id: string, status: Extract<StatusConhecimento, 'aprovado' | 'rejeitado'>) =>
      req<Conhecimento>(`/conhecimento/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    editar: (id: string, patch: { titulo?: string; conteudo?: string }) =>
      req<Conhecimento>(`/conhecimento/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    excluir: (id: string) => req(`/conhecimento/${id}`, { method: 'DELETE' }),
  },

  missoes: {
    listar: () => req<Missao[]>('/missoes'),
    obter: (id: string) => req<Missao>(`/missoes/${id}`),
    assumir: (id: string) =>
      req<Missao>(`/missoes/${id}/assumir`, { method: 'POST', body: '{}' }),
    devolverIa: (id: string) =>
      req<Missao>(`/missoes/${id}/devolver-ia`, { method: 'POST', body: '{}' }),
    criar: (data: {
      telefone: string
      numeroId: string
      tipo?: string
      modo?: string
      objetivo: string
      contexto?: string
      criterioConclusao?: string
      tom?: string
      informacoes?: string
      nomeContato?: string
    }) => req<Missao>('/missoes', { method: 'POST', body: JSON.stringify(data) }),
    criarLote: (data: {
      numeroId: string
      tipo?: string
      modo?: string
      objetivo: string
      contexto?: string
      criterioConclusao?: string
      tom?: string
      informacoes?: string
      contatos?: { telefone: string; nome?: string }[]
      tagId?: string
    }) =>
      req<{ criadas: number; missoes: Missao[] }>('/missoes/lote', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    editar: (
      id: string,
      patch: {
        tipo?: string
        modo?: string
        objetivo?: string
        contexto?: string | null
        criterioConclusao?: string | null
        tom?: string | null
        informacoes?: string | null
        nomeContato?: string
      },
    ) =>
      req<Missao>(`/missoes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    aprovarRascunho: (id: string, texto?: string) =>
      req(`/missoes/${id}/rascunho/aprovar`, {
        method: 'POST',
        body: JSON.stringify(texto != null ? { texto } : {}),
      }),
    descartarRascunho: (id: string) =>
      req(`/missoes/${id}/rascunho/descartar`, { method: 'POST', body: '{}' }),
    mudarEstado: (id: string, estado: EstadoMissao) =>
      req<Missao>(`/missoes/${id}/estado`, {
        method: 'POST',
        body: JSON.stringify({ estado }),
      }),
    iniciar: (id: string) =>
      req(`/missoes/${id}/iniciar`, { method: 'POST', body: '{}' }),
    iniciarLote: (ids: string[]) =>
      req<ResultadoDisparo>('/missoes/iniciar-lote', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },

  envio: (data: {
    numeroId: string
    telefone: string
    texto: string
    missaoId?: string
  }) => req('/envio', { method: 'POST', body: JSON.stringify(data) }),
}
