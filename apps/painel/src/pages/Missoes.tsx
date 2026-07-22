import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, LayoutGrid, List, Plus, Target, X } from 'lucide-react'
import { api } from '../lib/api'
import { COLUNAS, TIPO_INFO, TIPOS_MISSAO, podeTransicionar } from '../lib/estados'
import { toast } from '../lib/toast'
import type { ContatoResumo, EstadoMissao, Missao, Numero } from '../lib/types'
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

// "5583999998888, Fulano" (um por linha; vírgula/; separa nome) → contatos válidos
function parseContatos(txt: string): { telefone: string; nome?: string }[] {
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [tel, ...resto] = l.split(/[,;\t]/)
      return { telefone: (tel ?? '').replace(/\D/g, ''), nome: resto.join(' ').trim() || undefined }
    })
    .filter((c) => c.telefone.length >= 8)
}

function NovaMissaoModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [form, setForm] = useState({ numeroId: '', tipo: 'vender', objetivo: '', contexto: '', criterioConclusao: '', tom: '', informacoes: '', contatos: '' })
  const [salvando, setSalvando] = useState(false)
  const [base, setBase] = useState<ContatoResumo[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [buscaBase, setBuscaBase] = useState('')

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const conectado = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (conectado) setForm((f) => ({ ...f, numeroId: conectado.id }))
    })
    api.contatos.listar().then((cs) => setBase(cs.filter((c) => !c.optOut))).catch(() => {})
  }, [])

  const baseFiltrada = useMemo(() => {
    const q = buscaBase.trim().toLowerCase()
    if (!q) return base
    return base.filter((c) => (c.nome ?? '').toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '')))
  }, [base, buscaBase])

  // combina os selecionados da base + os colados, sem duplicar telefone
  const contatos = useMemo(() => {
    const daBase = base.filter((c) => sel.has(c.id)).map((c) => ({ telefone: c.telefone, nome: c.nome ?? undefined }))
    const colados = parseContatos(form.contatos)
    const vistos = new Set<string>()
    return [...daBase, ...colados].filter((c) => (vistos.has(c.telefone) ? false : vistos.add(c.telefone)))
  }, [base, sel, form.contatos])

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const criar = async () => {
    if (!form.numeroId) return toast('Cadastre/conecte um número primeiro.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo da missão.', 'erro')
    if (contatos.length === 0) return toast('Informe ao menos um contato válido.', 'erro')
    setSalvando(true)
    try {
      const { criadas } = await api.missoes.criarLote({
        numeroId: form.numeroId,
        tipo: form.tipo,
        objetivo: form.objetivo.trim(),
        contexto: form.contexto.trim() || undefined,
        criterioConclusao: form.criterioConclusao.trim() || undefined,
        tom: form.tom.trim() || undefined,
        informacoes: form.informacoes.trim() || undefined,
        contatos,
      })
      toast(criadas === 1 ? 'Missão criada.' : `${criadas} missões criadas (uma por contato).`, 'ok')
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
            <label className="mb-1 block text-xs text-slate-400">Tipo de missão</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_MISSAO.map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition',
                    form.tipo === t ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-slate-400 ring-white/10 hover:text-slate-200',
                  )}
                >
                  {TIPO_INFO[t].emoji} {TIPO_INFO[t].label}
                </button>
              ))}
            </div>
          </div>
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
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Escolher da base</span>
              {contatos.length > 0 && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  {contatos.length} no total
                </span>
              )}
            </label>
            <input
              value={buscaBase}
              onChange={(e) => setBuscaBase(e.target.value)}
              placeholder="Buscar contato pra adicionar…"
              className={campo}
            />
            <div className="mt-1.5 max-h-40 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10">
              {base.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-600">Base vazia — importe contatos na aba Contatos, ou cole números abaixo.</p>
              ) : baseFiltrada.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-600">Nenhum contato encontrado.</p>
              ) : (
                baseFiltrada.slice(0, 60).map((c) => (
                  <button key={c.id} type="button" onClick={() => alternar(c.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5">
                    <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', sel.has(c.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-white/25')}>
                      {sel.has(c.id) && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-sm text-slate-200">{c.nome ?? `+${c.telefone}`}</span>
                    {c.nome && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-500">+{c.telefone}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Ou cole novos números <span className="text-slate-600">— um por linha: telefone[, nome]</span></label>
            <textarea
              value={form.contatos}
              onChange={(e) => setForm({ ...form, contatos: e.target.value })}
              rows={2}
              placeholder={'5583999998888, Fornecedor A\n5511988887777, Fornecedor B'}
              className={cn(campo, 'resize-none font-mono text-[13px]')}
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              🚀 Cada contato vira uma conversa própria (memória e estado independentes).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Objetivo</label>
            <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Qualificar o lead e agendar uma conversa" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Critério de conclusão (opcional)</label>
            <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} placeholder="Ex.: reunião agendada · orçamento aceito · pagamento confirmado" className={campo} />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">🎯 Quando isto acontece, a IA marca a missão como <b>concluída</b>.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Contexto (opcional)</label>
            <textarea value={form.contexto} onChange={(e) => setForm({ ...form, contexto: e.target.value })} rows={2} placeholder="Ex.: empresa de automação industrial, ticket médio alto…" className={cn(campo, 'resize-none')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Tom / humor (opcional)</label>
            <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} placeholder="Ex.: amigável e descontraído, com leveza" className={campo} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
              Informações autorizadas (opcional)
            </label>
            <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={3} placeholder="Preços, prazos e condições REAIS que a IA pode afirmar. Ex.: Plano Pro R$299/mês, entrega em 7 dias úteis." className={cn(campo, 'resize-none')} />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              🛡️ A IA só afirma o que estiver aqui. Fora disso, ela não inventa — confirma ou escala.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>
            {contatos.length > 1 ? `Criar ${contatos.length} missões` : 'Criar missão'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function Missoes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [missoes, setMissoes] = useState<Missao[] | null>(null)
  const [vista, setVista] = useState<'board' | 'lista'>('board')
  const [filtro, setFiltro] = useState<EstadoMissao | 'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [arrastando, setArrastando] = useState<Missao | null>(null)

  const carregar = async () => {
    try {
      setMissoes(await api.missoes.listar())
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 6000)
    return () => clearInterval(t)
  }, [])

  const filtros = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const m of missoes ?? []) contagem.set(m.estado, (contagem.get(m.estado) ?? 0) + 1)
    return contagem
  }, [missoes])

  // arrastar um card para outra coluna = mudar de estado (validado pelo domínio)
  const mover = async (m: Missao, estado: EstadoMissao) => {
    if (m.estado === estado) return
    if (!podeTransicionar(m.estado, estado)) {
      toast(`Transição ${ESTADO_INFO[m.estado].label} → ${ESTADO_INFO[estado].label} não é permitida.`, 'erro')
      return
    }
    // otimista: move na hora, confirma no servidor
    setMissoes((ms) => (ms ?? []).map((x) => (x.id === m.id ? { ...x, estado } : x)))
    try {
      await api.missoes.mudarEstado(m.id, estado)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      carregar()
    }
  }

  const visiveis = (missoes ?? []).filter((m) => filtro === 'todas' || m.estado === filtro)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-inset ring-white/10">
          <VistaBtn ativo={vista === 'board'} onClick={() => setVista('board')} icon={<LayoutGrid className="h-4 w-4" />} label="Board" />
          <VistaBtn ativo={vista === 'lista'} onClick={() => setVista('lista')} icon={<List className="h-4 w-4" />} label="Lista" />
        </div>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>
      </div>

      {missoes === null ? (
        <div className="grid flex-1 place-items-center"><Spinner className="h-6 w-6" /></div>
      ) : missoes.length === 0 ? (
        <EmptyState icon={<Target className="h-6 w-6" />} titulo="Nenhuma missão ainda" texto="Crie uma missão (para 1 ou vários contatos) e solte a IA pra conduzir a conversa." acao={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>} />
      ) : vista === 'board' ? (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {COLUNAS.map((estado) => {
            const cards = (missoes ?? []).filter((m) => m.estado === estado)
            const soltavel = arrastando ? podeTransicionar(arrastando.estado, estado) && arrastando.estado !== estado : false
            const info = ESTADO_INFO[estado]
            return (
              <div
                key={estado}
                onDragOver={(e) => soltavel && e.preventDefault()}
                onDrop={() => arrastando && mover(arrastando, estado)}
                className={cn(
                  'flex w-64 shrink-0 flex-col rounded-2xl border p-2 transition',
                  arrastando
                    ? soltavel
                      ? 'border-indigo-500/50 bg-indigo-500/[0.06]'
                      : 'border-white/5 bg-transparent opacity-40'
                    : 'border-white/8 bg-white/[0.02]',
                )}
              >
                <div className="mb-2 flex items-center gap-2 px-2 py-1">
                  <Dot className={info.dot} />
                  <span className="text-sm font-medium text-slate-200">{info.label}</span>
                  <span className="ml-auto rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums text-slate-400">{cards.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {cards.map((m) => (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => setArrastando(m)}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => onAbrir(m.id)}
                      className="group cursor-pointer rounded-xl border border-white/8 bg-white/[0.04] p-3 transition hover:border-white/20 hover:bg-white/[0.07] active:cursor-grabbing"
                    >
                      <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-indigo-300/80">
                        {TIPO_INFO[m.tipo]?.emoji} {TIPO_INFO[m.tipo]?.label ?? m.tipo}
                      </span>
                      <p className="line-clamp-2 text-sm font-medium text-slate-100">{m.objetivo}</p>
                      <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        {m.contato?.nome ?? `+${m.contato?.telefone ?? '—'}`}
                        {m.iaPausada && <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">humano</span>}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">{tempoRelativo(m.criadoEm)}</p>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-600">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Chip ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} label="Todas" n={missoes?.length ?? 0} />
            {(Object.keys(ESTADO_INFO) as EstadoMissao[])
              .filter((e) => (filtros.get(e) ?? 0) > 0)
              .map((e) => (
                <Chip key={e} ativo={filtro === e} onClick={() => setFiltro(e)} label={ESTADO_INFO[e].label} n={filtros.get(e) ?? 0} dot={ESTADO_INFO[e].dot} />
              ))}
          </div>
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

function VistaBtn({ ativo, onClick, icon, label }: { ativo: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
        ativo ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
      )}
    >
      {icon}
      {label}
    </button>
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
