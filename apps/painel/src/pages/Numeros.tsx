import { useEffect, useState } from 'react'
import { Plus, QrCode, SlidersHorizontal, Smartphone, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Numero, SaudeNumero } from '../lib/types'
import {
  Badge,
  Button,
  CONEXAO_INFO,
  Card,
  Dot,
  EmptyState,
  Spinner,
  cn,
} from '../lib/ui'

function ConfigModal({ numero, onFechar }: { numero: Numero; onFechar: (salvou: boolean) => void }) {
  const [form, setForm] = useState({
    janelaInicio: numero.janelaInicio,
    janelaFim: numero.janelaFim,
    budgetDiario: String(numero.budgetDiario),
    maxConversasAtivas: String(numero.maxConversasAtivas),
    suporteReativo: numero.suporteReativo,
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    const budget = Number(form.budgetDiario)
    const cap = Number(form.maxConversasAtivas)
    if (!Number.isInteger(budget) || budget < 1) return toast('Budget diário deve ser ≥ 1.', 'erro')
    if (!Number.isInteger(cap) || cap < 1) return toast('Cap de conversas deve ser ≥ 1.', 'erro')
    setSalvando(true)
    try {
      await api.numeros.editar(numero.id, {
        janelaInicio: form.janelaInicio,
        janelaFim: form.janelaFim,
        budgetDiario: budget,
        maxConversasAtivas: cap,
        suporteReativo: form.suporteReativo,
      })
      toast('Configuração salva.', 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-content">Anti-bloqueio · +{numero.telefone}</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-5 text-xs text-muted">Ritmo humano do chip. Comece conservador em número novo.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Janela — início</label>
              <input value={form.janelaInicio} onChange={(e) => setForm({ ...form, janelaInicio: e.target.value })} placeholder="08:00" className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Janela — fim</label>
              <input value={form.janelaFim} onChange={(e) => setForm({ ...form, janelaFim: e.target.value })} placeholder="20:00" className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Budget diário (envios)</label>
              <input type="number" min={1} value={form.budgetDiario} onChange={(e) => setForm({ ...form, budgetDiario: e.target.value })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Cap conversas ativas</label>
              <input type="number" min={1} value={form.maxConversasAtivas} onChange={(e) => setForm({ ...form, maxConversasAtivas: e.target.value })} className={campo} />
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted">
            🛡️ Janela = horário permitido de envio · Budget = teto de mensagens/dia · Cap = máximo de conversas simultâneas que a IA inicia.
          </p>
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, suporteReativo: !form.suporteReativo })}
              className="flex w-full items-start gap-3 text-left"
            >
              <span className={cn('mt-0.5 grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', form.suporteReativo ? 'bg-emerald-500' : 'bg-line-strong')}>
                <span className={cn('h-4 w-4 rounded-full bg-white transition', form.suporteReativo && 'translate-x-4')} />
              </span>
              <span>
                <span className="block text-sm font-medium text-content">🛟 Suporte reativo</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">A IA atende automaticamente qualquer um que mandar mensagem neste número. Defina a persona pelo assistente (missão tipo Suporte).</span>
              </span>
            </button>
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
          <h3 className="font-semibold text-content">Conectar {numero.telefone}</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid aspect-square w-full place-items-center rounded-xl bg-white p-3">
          {qr ? (
            <img src={qr} alt="QR Code" className="h-full w-full object-contain" />
          ) : erro ? (
            <p className="px-4 text-center text-sm text-rose-600">{erro}</p>
          ) : (
            <Spinner className="text-muted" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <Dot className={CONEXAO_INFO[status].dot} pulse={CONEXAO_INFO[status].pulse} />
          <span className="text-sm text-muted">{CONEXAO_INFO[status].label}…</span>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          No WhatsApp do chip: <b className="text-muted">Aparelhos conectados → Conectar um aparelho</b> e escaneie.
        </p>
      </Card>
    </div>
  )
}

const SAUDE_INFO: Record<SaudeNumero['status'], { label: string; cls: string; dot: string }> = {
  saudavel: { label: 'Saudável', cls: 'bg-emerald-500/12 text-emerald-300', dot: 'bg-emerald-400' },
  atencao: { label: 'Atenção', cls: 'bg-amber-500/12 text-amber-300', dot: 'bg-amber-400' },
  risco: { label: 'Risco de bloqueio', cls: 'bg-rose-500/12 text-rose-300', dot: 'bg-rose-400' },
  amostra_baixa: { label: 'Coletando dados', cls: 'bg-surface2 text-muted', dot: 'bg-slate-500' },
}

function SaudeBadge({ saude }: { saude: SaudeNumero }) {
  const info = SAUDE_INFO[saude.status]
  const rate = saude.replyRate != null ? `${Math.round(saude.replyRate * 100)}% resposta` : `${saude.base} iniciadas`
  return (
    <div className={`mt-4 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium ${info.cls}`} title="Saúde anti-bloqueio: taxa de resposta dos últimos 30 dias. Abaixo de 15% pausa novas iniciações.">
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
      <span className="opacity-70">· {rate}</span>
    </div>
  )
}

export function Numeros() {
  const [numeros, setNumeros] = useState<Numero[] | null>(null)
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conectar, setConectar] = useState<Numero | null>(null)
  const [configurar, setConfigurar] = useState<Numero | null>(null)

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
        <label className="text-sm font-medium text-content">Cadastrar novo número (chip)</label>
        <p className="mb-3 mt-0.5 text-xs text-muted">Use um chip dedicado/aquecido — DDI+DDD (ex.: 5583999998888).</p>
        <div className="flex gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cadastrar()}
            placeholder="5583999998888"
            className="flex-1 rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none"
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
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-content">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-content">+{n.telefone}</p>
                      <p className="text-xs text-muted">{n.instanciaEvolution}</p>
                    </div>
                  </div>
                  <Badge className={info.badge}>
                    <Dot className={info.dot} pulse={info.pulse} /> {info.label}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface2 py-2" title={`Teto efetivo do dia = menor entre o budget (${n.budgetDiario}) e o teto do estágio ${n.aquecimentoEstagio}. Ao atingir, o anti-bloqueio pausa novos envios.`}>
                    <p className="text-sm font-semibold text-content">{n.enviadosHoje}/{n.tetoEfetivo}</p>
                    <p className="text-[11px] text-muted">hoje (teto)</p>
                  </div>
                  <div className="rounded-lg bg-surface2 py-2">
                    <p className="text-sm font-semibold text-content">nível {n.aquecimentoEstagio}</p>
                    <p className="text-[11px] text-muted">aquecimento</p>
                  </div>
                  <div className="rounded-lg bg-surface2 py-2">
                    <p className="text-sm font-semibold text-content">{n.janelaInicio}–{n.janelaFim}</p>
                    <p className="text-[11px] text-muted">janela</p>
                  </div>
                </div>

                {n.saude && <SaudeBadge saude={n.saude} />}

                <p className="mt-3 text-center text-[11px] text-muted">
                  cap de <span className="font-medium text-content">{n.maxConversasAtivas}</span> conversas ativas
                </p>
                {n.suporteReativo && (
                  <p className="mt-2 text-center text-[11px] font-medium text-emerald-300">🛟 suporte reativo ativo</p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setConectar(n)}>
                    <QrCode className="h-4 w-4" />
                    {n.statusConexao === 'conectado' ? 'Reconectar' : 'Conectar via QR'}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfigurar(n)} title="Anti-bloqueio">
                    <SlidersHorizontal className="h-4 w-4" />
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

      {configurar && (
        <ConfigModal
          numero={configurar}
          onFechar={(salvou) => {
            setConfigurar(null)
            if (salvou) carregar()
          }}
        />
      )}
    </div>
  )
}
