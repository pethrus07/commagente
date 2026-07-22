import type { Missao, Numero, QrResposta, Stats, EstadoMissao } from './types'

const BASE = '/api' // proxy do Vite -> API Fastify (:3000)

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  })
  const texto = await res.text()
  const dados = texto ? JSON.parse(texto) : null
  if (!res.ok) {
    const msg = dados?.erro ?? `${res.status} ${res.statusText}`
    throw new Error(typeof msg === 'string' ? msg : 'Erro na API')
  }
  return dados as T
}

export const api = {
  stats: () => req<Stats>('/stats'),

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
  },

  missoes: {
    listar: () => req<Missao[]>('/missoes'),
    obter: (id: string) => req<Missao>(`/missoes/${id}`),
    criar: (data: {
      telefone: string
      numeroId: string
      objetivo: string
      contexto?: string
      tom?: string
      informacoes?: string
      nomeContato?: string
    }) => req<Missao>('/missoes', { method: 'POST', body: JSON.stringify(data) }),
    editar: (
      id: string,
      patch: {
        objetivo?: string
        contexto?: string | null
        tom?: string | null
        informacoes?: string | null
        nomeContato?: string
      },
    ) =>
      req<Missao>(`/missoes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    mudarEstado: (id: string, estado: EstadoMissao) =>
      req<Missao>(`/missoes/${id}/estado`, {
        method: 'POST',
        body: JSON.stringify({ estado }),
      }),
    iniciar: (id: string) =>
      req(`/missoes/${id}/iniciar`, { method: 'POST', body: '{}' }),
  },

  envio: (data: {
    numeroId: string
    telefone: string
    texto: string
    missaoId?: string
  }) => req('/envio', { method: 'POST', body: JSON.stringify(data) }),
}
