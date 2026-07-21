import { useEffect, useState } from 'react'
import { Plus, QrCode, Smartphone, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Numero } from '../lib/types'
import {
  Badge,
  Button,
  CONEXAO_INFO,
  Card,
  Dot,
  EmptyState,
  Spinner,
} from '../lib/ui'

function ConectarModal({ numero, onFechar }: { numero: Numero; onFechar: (conectou: boolean) => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [status, setStatus] = useState(numero.statusConexao)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api.numeros
      .conectar(numero.id)
      .then((r) => vivo && setQr(r.base64))
      .catch((e) => vivo && setErro((e as Error).message))
    const t = setInterval(async () => {
      try {
        const { status } = await api.numeros.status(numero.id)
        if (!vivo) return
        setStatus(status)
        if (status === 'conectado') {
          toast('Número conectado! 🎉', 'ok')
          clearInterval(t)
          onFechar(true)
        }
      } catch {
        /* ignora durante o poll */
      }
    }, 3000)
    return () => {
      vivo = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero.id])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Conectar {numero.telefone}</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid aspect-square w-full place-items-center rounded-xl bg-white p-3">
          {qr ? (
            <img src={qr} alt="QR Code" className="h-full w-full object-contain" />
          ) : erro ? (
            <p className="px-4 text-center text-sm text-rose-600">{erro}</p>
          ) : (
            <Spinner className="text-slate-400" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <Dot className={CONEXAO_INFO[status].dot} pulse={CONEXAO_INFO[status].pulse} />
          <span className="text-sm text-slate-400">{CONEXAO_INFO[status].label}…</span>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
          No WhatsApp do chip: <b className="text-slate-400">Aparelhos conectados → Conectar um aparelho</b> e escaneie.
        </p>
      </Card>
    </div>
  )
}

export function Numeros() {
  const [numeros, setNumeros] = useState<Numero[] | null>(null)
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conectar, setConectar] = useState<Numero | null>(null)

  const carregar = async () => {
    try {
      setNumeros(await api.numeros.listar())
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  useEffect(() => {
    carregar()
  }, [])

  const cadastrar = async () => {
    if (novo.trim().length < 8) return toast('Telefone inválido (use DDI+DDD).', 'erro')
    setSalvando(true)
    try {
      await api.numeros.cadastrar(novo.replace(/\D/g, ''))
      setNovo('')
      toast('Número cadastrado.', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <label className="text-sm font-medium text-slate-300">Cadastrar novo número (chip)</label>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">Use um chip dedicado/aquecido — DDI+DDD (ex.: 5583999998888).</p>
        <div className="flex gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cadastrar()}
            placeholder="5583999998888"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
          />
          <Button onClick={cadastrar} loading={salvando}>
            <Plus className="h-4 w-4" /> Cadastrar
          </Button>
        </div>
      </Card>

      {numeros === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : numeros.length === 0 ? (
        <EmptyState icon={<Smartphone className="h-6 w-6" />} titulo="Nenhum número ainda" texto="Cadastre um chip acima e conecte via QR." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {numeros.map((n) => {
            const info = CONEXAO_INFO[n.statusConexao]
            return (
              <Card key={n.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-slate-300">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">+{n.telefone}</p>
                      <p className="text-xs text-slate-500">{n.instanciaEvolution}</p>
                    </div>
                  </div>
                  <Badge className={info.badge}>
                    <Dot className={info.dot} pulse={info.pulse} /> {info.label}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/[0.03] py-2">
                    <p className="text-sm font-semibold text-slate-200">{n.enviadosHoje}/{n.budgetDiario}</p>
                    <p className="text-[11px] text-slate-500">hoje</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] py-2">
                    <p className="text-sm font-semibold text-slate-200">nível {n.aquecimentoEstagio}</p>
                    <p className="text-[11px] text-slate-500">aquecimento</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] py-2">
                    <p className="text-sm font-semibold text-slate-200">{n.janelaInicio}–{n.janelaFim}</p>
                    <p className="text-[11px] text-slate-500">janela</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="ghost" className="w-full" onClick={() => setConectar(n)}>
                    <QrCode className="h-4 w-4" />
                    {n.statusConexao === 'conectado' ? 'Reconectar' : 'Conectar via QR'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {conectar && (
        <ConectarModal
          numero={conectar}
          onFechar={(conectou) => {
            setConectar(null)
            if (conectou) carregar()
          }}
        />
      )}
    </div>
  )
}
