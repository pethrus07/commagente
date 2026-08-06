import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ChevronRight, LayoutGrid, List, Plus, Send, Target } from 'lucide-react'
import { AssistenteMissao } from '../components/AssistenteMissao'
import { api } from '../lib/api'
import { COLUNAS, TIPO_INFO, descreverDisparo, podeTransicionarManual } from '../lib/estados'
import { toast } from '../lib/toast'
import type { EstadoMissao, Missao } from '../lib/types'
import {
  Badge,
  Button,
  Dot,
  ESTADO_INFO,
  EmptyState,
  Spinner,
  cn,
  tempoRelativo,
} from '../lib/ui'

export function Missoes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [missoes, setMissoes] = useState<Missao[] | null>(null)
  const [vista, setVista] = useState<'board' | 'lista'>('board')
  const [filtro, setFiltro] = useState<EstadoMissao | 'todas'>('todas')
  const [modal, setModal] = useState(false)
  const [arrastando, setArrastando] = useState<Missao | null>(null)
  const [iniciandoLote, setIniciandoLote] = useState(false)

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

  const configuradas = (missoes ?? []).filter((m) => m.estado === 'configurada')
  const iniciarConfiguradas = async () => {
    const ids = configuradas.map((m) => m.id)
    if (!ids.length) return
    setIniciandoLote(true)
    try {
      const r = await api.missoes.iniciarLote(ids)
      toast(`Disparo — ${descreverDisparo(r)}.`, 'ok')
      await carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setIniciandoLote(false)
    }
  }

  const filtros = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const m of missoes ?? []) contagem.set(m.estado, (contagem.get(m.estado) ?? 0) + 1)
    return contagem
  }, [missoes])

  // arrastar um card para outra coluna = mudar de estado (validado pelo domínio)
  const mover = async (m: Missao, estado: EstadoMissao) => {
    if (m.estado === estado) return
    if (!podeTransicionarManual(m.estado, estado)) {
      toast(
        m.estado === 'configurada' && estado === 'na_fila'
          ? 'Pra ativar, use o botão "Iniciar" — ele que envia a mensagem de abertura.'
          : `Esse status é controlado pelo sistema — não dá pra mover na mão.`,
        'erro',
      )
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
        <div className="inline-flex rounded-xl bg-surface2 p-1 ring-1 ring-inset ring-line">
          <VistaBtn ativo={vista === 'board'} onClick={() => setVista('board')} icon={<LayoutGrid className="h-4 w-4" />} label="Board" />
          <VistaBtn ativo={vista === 'lista'} onClick={() => setVista('lista')} icon={<List className="h-4 w-4" />} label="Lista" />
        </div>
        <div className="flex items-center gap-2">
          {configuradas.length > 0 && (
            <Button variant="ghost" onClick={iniciarConfiguradas} loading={iniciandoLote}>
              <Send className="h-4 w-4" /> Iniciar {configuradas.length} configurada{configuradas.length === 1 ? '' : 's'}
            </Button>
          )}
          <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>
        </div>
      </div>

      {missoes === null ? (
        <div className="grid flex-1 place-items-center"><Spinner className="h-6 w-6" /></div>
      ) : missoes.length === 0 ? (
        <EmptyState icon={<Target className="h-6 w-6" />} titulo="Nenhuma missão ainda" texto="Crie uma missão (para 1 ou vários contatos) e solte a IA pra conduzir a conversa." acao={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova missão</Button>} />
      ) : vista === 'board' ? (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {COLUNAS.map((estado) => {
            const cards = (missoes ?? []).filter((m) => m.estado === estado)
            const soltavel = arrastando ? podeTransicionarManual(arrastando.estado, estado) && arrastando.estado !== estado : false
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
                      : 'border-line bg-transparent opacity-40'
                    : 'border-line bg-surface2',
                )}
              >
                <div className="mb-2 flex items-center gap-2 px-2 py-1">
                  <Dot className={info.dot} />
                  <span className="text-sm font-medium text-content">{info.label}</span>
                  <span className="ml-auto rounded-full bg-surface2 px-1.5 text-[11px] tabular-nums text-muted">{cards.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {cards.map((m) => (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => setArrastando(m)}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => onAbrir(m.id)}
                      className="group cursor-pointer rounded-xl border border-line bg-surface2 p-3 transition hover:border-line-strong hover:bg-surface2 active:cursor-grabbing"
                    >
                      <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-indigo-300/80">
                        {TIPO_INFO[m.tipo]?.emoji} {TIPO_INFO[m.tipo]?.label ?? m.tipo}
                      </span>
                      <p className="line-clamp-2 text-sm font-medium text-content">{m.objetivo}</p>
                      <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted">
                        {m.contato?.nome ?? `+${m.contato?.telefone ?? '—'}`}
                        {m.iaPausada && <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">humano</span>}
                      </p>
                      <p className="mt-1 text-[11px] text-subtle">{tempoRelativo(m.criadoEm)}</p>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-subtle">—</p>
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
                  className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface2 p-4 text-left transition hover:border-line-strong hover:bg-surface2"
                >
                  <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', info.badge)}>
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-content">{m.objetivo}</p>
                    <p className="truncate text-xs text-muted">
                      {m.contato?.nome ? `${m.contato.nome} · ` : ''}+{m.contato?.telefone ?? '—'} · {tempoRelativo(m.criadoEm)}
                    </p>
                  </div>
                  <Badge className={info.badge}><Dot className={info.dot} /> {info.label}</Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-subtle group-hover:text-content" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {modal && (
        <AssistenteMissao
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
        ativo ? 'bg-surface2 text-content' : 'text-muted hover:text-content',
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
        ativo ? 'bg-surface2 text-content ring-1 ring-inset ring-line' : 'text-muted hover:bg-surface2 hover:text-content',
      )}
    >
      {dot && <Dot className={dot} />}
      {label}
      <span className="rounded-full bg-surface2 px-1.5 text-[10px] tabular-nums text-content">{n}</span>
    </button>
  )
}
