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
    apelido: numero.apelido ?? '',
    janelaInicio: numero.janelaInicio,
    janelaFim: numero.janelaFim,
    budgetDiario: String(numero.budgetDiario),
    aquecimentoEstagio: String(numero.aquecimentoEstagio),
    maxConversasAtivas: String(numero.maxConversasAtivas),
    semLimite: numero.semLimite ?? false,
    suporteReativo: numero.suporteReativo,
    avisarEscalonamento: numero.avisarEscalonamento,
    numeroAviso: numero.numeroAviso ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)

  const salvar = async () => {
    const budget = Number(form.budgetDiario)
    const cap = Number(form.maxConversasAtivas)
    if (!Number.isInteger(budget) || budget < 1) return toast('Budget diário deve ser ≥ 1.', 'erro')
    if (!Number.isInteger(cap) || cap < 1) return toast('Cap de conversas deve ser ≥ 1.', 'erro')
    setSalvando(true)
    try {
      await api.numeros.editar(numero.id, {
        apelido: form.apelido.trim() || null,
        janelaInicio: form.janelaInicio,
        janelaFim: form.janelaFim,
        budgetDiario: budget,
        aquecimentoEstagio: Number(form.aquecimentoEstagio),
        maxConversasAtivas: cap,
        semLimite: form.semLimite,
        suporteReativo: form.suporteReativo,
        avisarEscalonamento: form.avisarEscalonamento,
        numeroAviso: form.numeroAviso.trim() || null,
      })
      toast('Configuração salva.', 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  // testa o aviso: salva a config do aviso (pra usar o número da tela) e dispara um teste
  const testar = async () => {
    setTestando(true)
    try {
      await api.numeros.editar(numero.id, {
        avisarEscalonamento: form.avisarEscalonamento,
        numeroAviso: form.numeroAviso.trim() || null,
      })
      const r = await api.numeros.testarAviso(numero.id)
      toast(`Aviso de teste enviado pra +${r.destino}. Confira o WhatsApp.`, 'ok')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setTestando(false)
    }
  }

  const campo = 'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-content">{numero.apelido || `+${numero.telefone}`}</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-5 text-xs text-muted">{numero.apelido ? `+${numero.telefone} · ` : ''}Identidade e ritmo humano do chip. Comece conservador em número novo.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Apelido (identificação na plataforma)</label>
            <input value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} placeholder="Ex.: Comercial, João, Vendas SP" maxLength={60} className={campo} />
          </div>
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
          <div>
            <label className="mb-1 block text-xs text-muted">Estágio de aquecimento (chip novo → maduro)</label>
            <select value={form.aquecimentoEstagio} onChange={(e) => setForm({ ...form, aquecimentoEstagio: e.target.value })} className={campo}>
              {[['1', '20'], ['2', '50'], ['3', '120'], ['4', '250'], ['5', '400']].map(([est, teto]) => (
                <option key={est} value={est} className="bg-slate-900">Estágio {est} — até {teto} aberturas/dia</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-snug text-muted">O teto real de <b>aberturas de conversa</b> por dia é o <b>menor</b> entre o budget e o teto do estágio. Chip novo começa no 1 (20/dia) — suba conforme aquece. ⚠️ subir rápido demais aumenta o risco de bloqueio.</p>
          </div>
          <p className="text-[11px] leading-snug text-muted">
            🛡️ Janela = horário permitido de envio · Budget = teto de mensagens/dia · Cap = máximo de conversas simultâneas que a IA inicia.
          </p>
          <button
            type="button"
            onClick={() => setForm({ ...form, semLimite: !form.semLimite })}
            className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', form.semLimite ? 'border-rose-500/50 bg-rose-500/[0.08]' : 'border-line bg-surface2 hover:border-line-strong')}
          >
            <span className={cn('mt-0.5 grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', form.semLimite ? 'bg-rose-500' : 'bg-line-strong')}>
              <span className={cn('h-4 w-4 rounded-full bg-white transition', form.semLimite && 'translate-x-4')} />
            </span>
            <span>
              <span className="block text-sm font-medium text-content">🔥 Modo teste — sem freio anti-ban</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">Ignora <b>tudo</b>: janela, budget, aquecimento, espaçamento entre envios, saúde e anti-spam. Manda no talo. <b className="text-rose-300">Alto risco de bloqueio do WhatsApp</b> — use só em chip de teste que você topa perder.</span>
            </span>
          </button>
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
          <div className="border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, avisarEscalonamento: !form.avisarEscalonamento })}
              className="flex w-full items-start gap-3 text-left"
            >
              <span className={cn('mt-0.5 grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', form.avisarEscalonamento ? 'bg-emerald-500' : 'bg-line-strong')}>
                <span className={cn('h-4 w-4 rounded-full bg-white transition', form.avisarEscalonamento && 'translate-x-4')} />
              </span>
              <span>
                <span className="block text-sm font-medium text-content">🔔 Avisar escalonamento no WhatsApp</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">Quando uma conversa precisa de um humano, manda um aviso no WhatsApp com o contato + motivo. Reusa o self-send (o número avisa a si mesmo).</span>
              </span>
            </button>
            {form.avisarEscalonamento && (
              <div className="mt-3 space-y-2 pl-12">
                <input value={form.numeroAviso} onChange={(e) => setForm({ ...form, numeroAviso: e.target.value })} placeholder={`Número de aviso — vazio = o próprio (+${numero.telefone})`} className={campo} />
                <Button variant="ghost" onClick={testar} loading={testando} className="!py-1.5 !text-xs">Testar aviso agora</Button>
              </div>
            )}
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
  const [novoApelido, setNovoApelido] = useState('')
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
      await api.numeros.cadastrar(novo.replace(/\D/g, ''), novoApelido)
      setNovo('')
      setNovoApelido('')
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
        <p className="mb-3 mt-0.5 text-xs text-muted">Use um chip dedicado/aquecido — DDI+DDD (ex.: 5583999998888). O apelido é opcional e vira a identificação em toda a plataforma.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={novoApelido}
            onChange={(e) => setNovoApelido(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cadastrar()}
            placeholder="Apelido (ex.: Comercial, João)"
            maxLength={60}
            className="rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none sm:w-56"
          />
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
                      <p className="font-medium text-content">{n.apelido || `+${n.telefone}`}</p>
                      <p className="text-xs text-muted">{n.apelido ? `+${n.telefone}` : n.instanciaEvolution}</p>
                    </div>
                  </div>
                  <Badge className={info.badge}>
                    <Dot className={info.dot} pulse={info.pulse} /> {info.label}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface2 py-2" title={`Teto efetivo do dia = menor entre o budget (${n.budgetDiario}) e o teto do estágio ${n.aquecimentoEstagio}. Ao atingir, o anti-bloqueio pausa novas ABERTURAS (respostas continuam).`}>
                    <p className={cn('text-sm font-semibold', n.enviadosHoje >= n.tetoEfetivo ? 'text-amber-400' : 'text-content')}>{n.enviadosHoje}/{n.tetoEfetivo}</p>
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

                {n.statusConexao === 'conectado' && n.enviadosHoje >= n.tetoEfetivo && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-200">
                    <span>⏳</span>
                    <span><b>Limite diário do aquecimento atingido</b> ({n.tetoEfetivo} aberturas). Novas conversas ficam <b>seguradas</b> e saem quando o dia virar. Pra liberar hoje, suba o estágio de aquecimento em Configurar. (As respostas a conversas ativas continuam normalmente.)</span>
                  </div>
                )}

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
