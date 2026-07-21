import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Brain, Info, Rocket, Send, Sparkles } from 'lucide-react'
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
      </div>

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
