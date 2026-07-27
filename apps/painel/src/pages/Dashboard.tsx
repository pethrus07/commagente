import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  LifeBuoy,
  MessageSquare,
  Smartphone,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { TIPO_INFO } from '../lib/estados'
import { toast } from '../lib/toast'
import type { EstadoMissao, Historico, Stats, TipoMissao } from '../lib/types'
import { Card, ESTADO_INFO, Spinner, cn } from '../lib/ui'

const ORDEM: EstadoMissao[] = [
  'configurada',
  'na_fila',
  'em_conversa',
  'escalada',
  'concluida',
  'descartada',
  'sem_resposta',
  'arquivada',
]

function Kpi({
  icon: Icon,
  cor,
  label,
  valor,
  sub,
}: {
  icon: typeof Activity
  cor: string
  label: string
  valor: string | number
  sub?: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-content">{valor}</p>
          {sub && <p className="mt-1 text-xs text-subtle">{sub}</p>}
        </div>
        <div className={cn('grid h-11 w-11 place-items-center rounded-xl', cor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

const rotulo = (d: string) => {
  const [, m, dd] = d.split('-')
  return `${dd}/${m}`
}

function Atividade({ hist }: { hist: Historico }) {
  const dias = hist.dias
  const max = Math.max(1, ...dias.map((d) => d.mensagens))
  const tot = dias.reduce(
    (a, d) => ({
      mensagens: a.mensagens + d.mensagens,
      missoes: a.missoes + d.missoes,
      concluidas: a.concluidas + d.concluidas,
      escaladas: a.escaladas + d.escaladas,
    }),
    { mensagens: 0, missoes: 0, concluidas: 0, escaladas: 0 },
  )

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Activity className="h-4 w-4 text-subtle" />
        <h2 className="text-sm font-semibold text-content">Atividade — últimos {dias.length} dias</h2>
      </div>
      <p className="mb-5 text-xs text-subtle">Mensagens por dia (enviadas + recebidas).</p>

      <div className="flex h-32 items-end gap-1">
        {dias.map((d) => {
          const h = Math.round((d.mensagens / max) * 100)
          return (
            <div
              key={d.data}
              className="group relative flex flex-1 flex-col justify-end"
              title={`${rotulo(d.data)} · ${d.mensagens} msgs · ${d.missoes} missões · ${d.concluidas} concluídas`}
            >
              <div
                className="rounded-t bg-indigo-500/70 transition-all group-hover:bg-indigo-400"
                style={{ height: `${Math.max(h, 3)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-subtle">
        <span>{rotulo(dias[0]?.data ?? '')}</span>
        <span>{rotulo(dias[dias.length - 1]?.data ?? '')}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniTot icon={MessageSquare} cor="text-sky-400" n={tot.mensagens} label="mensagens" />
        <MiniTot icon={Target} cor="text-indigo-400" n={tot.missoes} label="missões novas" />
        <MiniTot icon={CheckCircle2} cor="text-emerald-400" n={tot.concluidas} label="concluídas" />
        <MiniTot icon={LifeBuoy} cor="text-orange-400" n={tot.escaladas} label="escaladas" />
      </div>
    </Card>
  )
}

function MiniTot({ icon: Icon, cor, n, label }: { icon: typeof Activity; cor: string; n: number; label: string }) {
  return (
    <div className="rounded-xl bg-surface2 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', cor)} />
        <span className="text-lg font-semibold tabular-nums text-content">{n}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-subtle">{label}</p>
    </div>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [hist, setHist] = useState<Historico | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      try {
        const [s, h] = await Promise.all([api.stats(), api.historico(14)])
        if (vivo) {
          setStats(s)
          setHist(h)
        }
      } catch (e) {
        toast((e as Error).message, 'erro')
      } finally {
        if (vivo) setCarregando(false)
      }
    }
    carregar()
    const t = setInterval(carregar, 8000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  if (carregando && !stats) {
    return (
      <div className="grid place-items-center py-32">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }
  if (!stats) return null

  const ativas =
    (stats.missoesPorEstado.em_conversa ?? 0) +
    (stats.missoesPorEstado.na_fila ?? 0) +
    (stats.missoesPorEstado.escalada ?? 0)
  const maxEstado = Math.max(1, ...Object.values(stats.missoesPorEstado))

  return (
    <div className="space-y-6">
      {stats.alertas?.length > 0 && (
        <div className="space-y-2">
          {stats.alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a.mensagem}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Activity} cor="bg-indigo-500/15 text-indigo-400" label="Missões ativas" valor={ativas} sub={`${stats.totalMissoes} no total`} />
        <Kpi icon={Smartphone} cor="bg-emerald-500/15 text-emerald-400" label="Números conectados" valor={`${stats.numeros.conectados}/${stats.numeros.total}`} sub="chips ligados à Evolution" />
        <Kpi icon={MessageSquare} cor="bg-sky-500/15 text-sky-400" label="Mensagens hoje" valor={stats.mensagensHoje} sub="enviadas + recebidas" />
        <Kpi icon={Users} cor="bg-violet-500/15 text-violet-400" label="Contatos" valor={stats.totalContatos} sub="leads na base" />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-subtle" />
          <h2 className="text-sm font-semibold text-content">Placar das missões</h2>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-4xl font-bold tracking-tight text-content tabular-nums">
              {stats.placar.taxaConclusao != null ? `${Math.round(stats.placar.taxaConclusao * 100)}%` : '—'}
            </p>
            <p className="mt-0.5 text-xs text-subtle">taxa de conclusão</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3">
            <MiniTot icon={CheckCircle2} cor="text-emerald-400" n={stats.placar.cumpridas} label="cumpridas" />
            <MiniTot icon={Activity} cor="text-indigo-400" n={stats.placar.ativas} label="ativas" />
            <MiniTot icon={XCircle} cor="text-rose-400" n={stats.placar.perdidas} label="perdidas" />
          </div>
        </div>
        {Object.keys(stats.missoesPorTipo).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {(Object.entries(stats.missoesPorTipo) as [TipoMissao, number][]).map(([t, n]) => (
              <span key={t} className="rounded-full bg-surface2 px-3 py-1 text-xs text-muted">
                {TIPO_INFO[t]?.emoji} {TIPO_INFO[t]?.label ?? t}: <span className="font-semibold text-content tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {hist && <Atividade hist={hist} />}

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Target className="h-4 w-4 text-subtle" />
          <h2 className="text-sm font-semibold text-content">Pipeline de missões</h2>
        </div>
        {stats.totalMissoes === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">Nenhuma missão ainda.</p>
        ) : (
          <div className="space-y-3">
            {ORDEM.filter((e) => (stats.missoesPorEstado[e] ?? 0) > 0).map((e) => {
              const n = stats.missoesPorEstado[e] ?? 0
              const info = ESTADO_INFO[e]
              return (
                <div key={e} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted">{info.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2">
                    <div className={cn('h-full rounded-full', info.dot)} style={{ width: `${(n / maxEstado) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-content">{n}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
