import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Target, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { EstadoMissao, Missao, Numero } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Dot,
  ESTADO_INFO,
  EmptyState,
  Spinner,
  cn,
  tempoRelativo,
} from '../lib/ui'

function NovaMissaoModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [form, setForm] = useState({ telefone: '', numeroId: '', objetivo: '', contexto: '', nomeContato: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const conectado = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (conectado) setForm((f) => ({ ...f, numeroId: conectado.id }))
    })
  }, [])

  const criar = async () => {
    if (!form.numeroId) return toast('Cadastre/conecte um número primeiro.', 'erro')
    if (form.telefone.replace(/\D/g, '').length < 8) return toast('Telefone do lead inválido.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo da missão.', 'erro')
    setSalvando(true)
    try {
      await api.missoes.criar({
        telefone: form.telefone.replace(/\D/g, ''),
        numeroId: form.numeroId,
        objetivo: form.objetivo.trim(),
        contexto: form.contexto.trim() || undefined,
        nomeContato: form.nomeContato.trim() || undefined,
      })
      toast('Missão criada.', 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-white">Nova missão</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Número (chip)</label>
            <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
              {numeros.length === 0 && <option value="">— nenhum número —</option>}
              {numeros.map((n) => (
                <option key={n.id} value={n.id} className="bg-slate-900">
                  +{n.telefone} ({n.statusConexao})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Telefone do lead</label>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="5583999998888" className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Nome (opcional)</label>
              <input value={form.nomeContato} onChange={(e) => setForm({ ...form, nomeContato: e.target.value })} placeholder="Fulano" className={campo} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Objetivo</label>
            <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Qualificar o lead e agendar uma conversa" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Contexto (opcional)</label>
            <textarea value={form.contexto} onChange={(e) => setForm({ ...form, contexto: e.target.value })} rows={3} placeholder="Ex.: empresa de automação industrial, ticket médio alto…" className={cn(campo, 'resize-none')} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>Criar missão</Button>
        </div>
      </Card>
    </div>
  )
}

export function Missoes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [missoes, setMissoes] = useState<Missao[] | null>(null)
  const [filtro, setFiltro] = useState<EstadoMissao | 'todas'>('todas')
  const [modal, setModal] = useState(false)

  const carregar = async () => {
    try {
      setMissoes(await api.missoes.listar())
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  useEffect(() => {
    carregar()
  }, [])

  const filtros = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const m of missoes ?? []) contagem.set(m.estado, (contagem.get(m.estado) ?? 0) + 1)
    return contagem
  }, [missoes])

  const visiveis = (missoes ?? []).filter((m) => filtro === 'todas' || m.estado === filtro)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} label="Todas" n={missoes?.length ?? 0} />
          {(Object.keys(ESTADO_INFO) as EstadoMissao[])
            .filter((e) => (filtros.get(e) ?? 0) > 0)
            .map((e) => (
              <Chip key={e} ativo={filtro === e} onClick={() => setFiltro(e)} label={ESTADO_INFO[e].label} n={filtros.get(e) ?? 0} dot={ESTADO_INFO[e].dot} />
            ))}
        </div>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>
      </div>

      {missoes === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : visiveis.length === 0 ? (
        <EmptyState icon={<Target className="h-6 w-6" />} titulo="Nenhuma missão aqui" texto="Crie uma missão e solte a IA pra conduzir a conversa." acao={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>} />
      ) : (
        <div className="space-y-2.5">
          {visiveis.map((m) => {
            const info = ESTADO_INFO[m.estado]
            return (
              <button
                key={m.id}
                onClick={() => onAbrir(m.id)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', info.badge)}>
                  <Target className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{m.objetivo}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.contato?.nome ? `${m.contato.nome} · ` : ''}+{m.contato?.telefone ?? '—'} · {tempoRelativo(m.criadoEm)}
                  </p>
                </div>
                <Badge className={info.badge}><Dot className={info.dot} /> {info.label}</Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-300" />
              </button>
            )
          })}
        </div>
      )}

      {modal && (
        <NovaMissaoModal
          onFechar={(criou) => {
            setModal(false)
            if (criou) carregar()
          }}
        />
      )}
    </div>
  )
}

function Chip({ ativo, onClick, label, n, dot }: { ativo: boolean; onClick: () => void; label: string; n: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
        ativo ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      )}
    >
      {dot && <Dot className={dot} />}
      {label}
      <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums text-slate-300">{n}</span>
    </button>
  )
}
