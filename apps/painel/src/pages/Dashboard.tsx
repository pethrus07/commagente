import { useEffect, useState } from 'react'
import {
  Activity,
  MessageSquare,
  Smartphone,
  Target,
  Users,
} from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { EstadoMissao, Stats } from '../lib/types'
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
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{valor}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={cn('grid h-11 w-11 place-items-center rounded-xl', cor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      try {
        const s = await api.stats()
        if (vivo) setStats(s)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Activity} cor="bg-indigo-500/15 text-indigo-400" label="Missões ativas" valor={ativas} sub={`${stats.totalMissoes} no total`} />
        <Kpi icon={Smartphone} cor="bg-emerald-500/15 text-emerald-400" label="Números conectados" valor={`${stats.numeros.conectados}/${stats.numeros.total}`} sub="chips ligados à Evolution" />
        <Kpi icon={MessageSquare} cor="bg-sky-500/15 text-sky-400" label="Mensagens hoje" valor={stats.mensagensHoje} sub="enviadas + recebidas" />
        <Kpi icon={Users} cor="bg-violet-500/15 text-violet-400" label="Contatos" valor={stats.totalContatos} sub="leads na base" />
      </div>

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-200">Pipeline de missões</h2>
        </div>
        {stats.totalMissoes === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma missão ainda.</p>
        ) : (
          <div className="space-y-3">
            {ORDEM.filter((e) => (stats.missoesPorEstado[e] ?? 0) > 0).map((e) => {
              const n = stats.missoesPorEstado[e] ?? 0
              const info = ESTADO_INFO[e]
              return (
                <div key={e} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-slate-400">{info.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className={cn('h-full rounded-full', info.dot)} style={{ width: `${(n / maxEstado) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-slate-200">{n}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
