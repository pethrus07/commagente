import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Brain,
  Hand,
  Info,
  LifeBuoy,
  Pencil,
  Play,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { EstadoMissao, Missao } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Dot,
  ESTADO_INFO,
  Spinner,
  cn,
  hora,
} from '../lib/ui'

// espelho da máquina de estados do domínio (para mostrar ações válidas)
const TRANSICOES: Record<EstadoMissao, EstadoMissao[]> = {
  configurada: ['na_fila', 'descartada', 'arquivada'],
  na_fila: ['em_conversa', 'descartada', 'arquivada'],
  em_conversa: ['concluida', 'sem_resposta', 'descartada', 'escalada'],
  escalada: ['em_conversa', 'concluida', 'descartada', 'arquivada'],
  concluida: ['arquivada'],
  sem_resposta: ['na_fila', 'arquivada'],
  descartada: ['arquivada'],
  arquivada: [],
}

export function MissaoDetalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [m, setM] = useState<Missao | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [controlando, setControlando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  const carregar = async () => {
    try {
      setM(await api.missoes.obter(id))
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [m?.mensagens?.length])

  if (!m) {
    return <div className="grid place-items-center py-32"><Spinner className="h-6 w-6" /></div>
  }

  const info = ESTADO_INFO[m.estado]
  const fatos = m.fatos && Object.keys(m.fatos).length > 0 ? m.fatos : null

  const mudar = async (estado: EstadoMissao) => {
    try {
      await api.missoes.mudarEstado(id, estado)
      toast(`Estado → ${ESTADO_INFO[estado].label}`, 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  const iniciar = async () => {
    setIniciando(true)
    try {
      await api.missoes.iniciar(id)
      toast('Missão iniciada — a IA vai abrir a conversa! 🚀', 'ok')
      setTimeout(carregar, 1500)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setIniciando(false)
    }
  }

  const assumir = async () => {
    setControlando(true)
    try {
      await api.missoes.assumir(id)
      toast('Você assumiu a conversa — a IA está pausada. 🤝', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setControlando(false)
    }
  }

  const devolver = async () => {
    setControlando(true)
    try {
      await api.missoes.devolverIa(id)
      toast('Devolvido pra IA — ela responde na próxima mensagem do lead. 🤖', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setControlando(false)
    }
  }

  const enviar = async () => {
    if (!texto.trim() || !m.numero || !m.contato) return
    setEnviando(true)
    try {
      await api.envio({ numeroId: m.numero.id, telefone: m.contato.telefone, texto: texto.trim(), missaoId: id })
      setTexto('')
      toast('Mensagem enviada.', 'ok')
      setTimeout(carregar, 1500)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onVoltar} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{m.objetivo}</p>
          <p className="text-xs text-slate-500">{m.contato?.nome ? `${m.contato.nome} · ` : ''}+{m.contato?.telefone}</p>
        </div>
        <Badge className={info.badge}><Dot className={info.dot} /> {info.label}</Badge>
        <button
          onClick={() => setEditando(true)}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          title="Editar missão"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {m.estado === 'escalada' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center">
          <LifeBuoy className="h-5 w-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-rose-100">A IA escalou esta conversa pra você</p>
            <p className="text-xs text-rose-200/70">{m.motivoEscala ? `Motivo: ${m.motivoEscala}` : 'Um humano precisa assumir.'}</p>
          </div>
          <Button onClick={assumir} loading={controlando} className="shrink-0">
            <Hand className="h-4 w-4" /> Assumir conversa
          </Button>
        </div>
      )}

      {m.estado !== 'escalada' && m.iaPausada && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
          <Hand className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-100">Você está no controle — a IA está pausada</p>
            <p className="text-xs text-amber-200/70">Responda pelo campo abaixo. Devolva pra IA quando quiser que ela retome.</p>
          </div>
          <Button variant="ghost" onClick={devolver} loading={controlando} className="shrink-0">
            <Play className="h-4 w-4" /> Devolver pra IA
          </Button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
        {/* conversa */}
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {(m.mensagens ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Sem mensagens ainda.</p>
            ) : (
              (m.mensagens ?? []).map((msg) => (
                <div key={msg.id} className={cn('flex', msg.direcao === 'out' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', msg.direcao === 'out' ? 'bg-indigo-500/90 text-white' : 'bg-white/8 text-slate-100')}>
                    <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                    <p className={cn('mt-1 text-[10px]', msg.direcao === 'out' ? 'text-indigo-100/70' : 'text-slate-500')}>
                      {hora(msg.criadaEm)}{msg.direcao === 'out' && msg.statusEnvio ? ` · ${msg.statusEnvio}` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={fimRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-white/8 p-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder="Responder manualmente…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
            />
            <Button onClick={enviar} loading={enviando} disabled={!texto.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </Card>

        {/* painel lateral */}
        <div className="space-y-4 overflow-y-auto">
          {(m.estado === 'configurada' ||
            (m.estado === 'na_fila' && (m.mensagens ?? []).length === 0)) && (
            <Card className="border-indigo-500/30 bg-indigo-500/10 p-4">
              <p className="text-sm font-medium text-white">Pronta para começar</p>
              <p className="mb-3 mt-0.5 text-xs text-slate-400">
                A IA vai abrir a conversa com o lead e conduzir rumo ao objetivo.
              </p>
              <Button className="w-full" onClick={iniciar} loading={iniciando}>
                <Rocket className="h-4 w-4" /> Iniciar missão
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ações de estado</p>
            <div className="flex flex-wrap gap-2">
              {TRANSICOES[m.estado].length === 0 ? (
                <span className="text-xs text-slate-500">Estado terminal.</span>
              ) : (
                TRANSICOES[m.estado].map((e) => (
                  <button key={e} onClick={() => mudar(e)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition hover:brightness-125', ESTADO_INFO[e].badge)}>
                    → {ESTADO_INFO[e].label}
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuração</p>
              </div>
              <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300">
                <Pencil className="h-3 w-3" /> Editar
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-0.5 text-[11px] uppercase tracking-wide text-slate-500">Tom / humor</p>
                <p className="text-sm text-slate-300">{m.tom || <span className="text-slate-600">Padrão (cordial e objetivo)</span>}</p>
              </div>
              <div>
                <p className="mb-0.5 text-[11px] uppercase tracking-wide text-slate-500">Informações autorizadas</p>
                {m.informacoes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{m.informacoes}</p>
                ) : (
                  <p className="text-sm text-amber-400/80">
                    ⚠️ Nenhuma. A IA não vai afirmar preço/prazo — vai confirmar ou escalar.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo (memória)</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{m.resumo || <span className="text-slate-600">Ainda sem resumo.</span>}</p>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fatos extraídos</p>
            </div>
            {fatos ? (
              <div className="space-y-1.5">
                {Object.entries(fatos).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-right font-medium text-slate-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Nenhum fato ainda.</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missão</p>
            </div>
            <dl className="space-y-1.5 text-sm">
              {m.contexto && <Linha rotulo="Contexto" valor={m.contexto} />}
              <Linha rotulo="Categoria" valor={m.categoriaResultado ?? '—'} />
              <Linha rotulo="Número" valor={m.numero ? `+${m.numero.telefone}` : '—'} />
              <Linha rotulo="Criada" valor={new Date(m.criadoEm).toLocaleString('pt-BR')} />
            </dl>
          </Card>
        </div>
      </div>

      {editando && (
        <EditarMissaoModal
          missao={m}
          onFechar={(salvou) => {
            setEditando(false)
            if (salvou) carregar()
          }}
        />
      )}
    </div>
  )
}

function EditarMissaoModal({ missao, onFechar }: { missao: Missao; onFechar: (salvou: boolean) => void }) {
  const [form, setForm] = useState({
    objetivo: missao.objetivo,
    nomeContato: missao.contato?.nome ?? '',
    contexto: missao.contexto ?? '',
    tom: missao.tom ?? '',
    informacoes: missao.informacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.objetivo.trim()) return toast('O objetivo não pode ficar vazio.', 'erro')
    setSalvando(true)
    try {
      await api.missoes.editar(missao.id, {
        objetivo: form.objetivo.trim(),
        nomeContato: form.nomeContato.trim(),
        contexto: form.contexto.trim() || null,
        tom: form.tom.trim() || null,
        informacoes: form.informacoes.trim() || null,
      })
      toast('Missão atualizada — vale a partir do próximo turno. ✅', 'ok')
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
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-white">Editar missão</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Objetivo</label>
            <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nome do contato</label>
            <input value={form.nomeContato} onChange={(e) => setForm({ ...form, nomeContato: e.target.value })} placeholder="Fulano" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Contexto</label>
            <textarea value={form.contexto} onChange={(e) => setForm({ ...form, contexto: e.target.value })} rows={2} placeholder="Ex.: empresa de automação industrial…" className={cn(campo, 'resize-none')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Tom / humor</label>
            <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} placeholder="Ex.: amigável e descontraído" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Informações autorizadas</label>
            <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={4} placeholder="Preços, prazos e condições REAIS. Ex.: Plano Pro R$299/mês, entrega em 7 dias úteis." className={cn(campo, 'resize-none')} />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              🛡️ A IA só afirma o que estiver aqui. Fora disso, não inventa — confirma ou escala.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={salvar} loading={salvando}>Salvar</Button>
        </div>
      </Card>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{rotulo}</dt>
      <dd className="text-right text-slate-300">{valor}</dd>
    </div>
  )
}
