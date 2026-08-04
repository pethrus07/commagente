import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2, Upload, Wallet, X } from 'lucide-react'
import { api } from '../lib/api'
import { TIPO_INFO, TIPOS_MISSAO, rotuloNumero } from '../lib/estados'
import { toast } from '../lib/toast'
import type { Agendamento, Numero } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

// "telefone, nome, dia" por linha → contatos (dia é opcional; acha o nº 1-31 em qualquer coluna)
function parseLinhas(txt: string): { telefone: string; nome?: string; dia?: number }[] {
  return txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => {
      const cols = l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
      let telefone = ''
      let nome = ''
      let dia: number | undefined
      for (const c of cols) {
        const dig = c.replace(/\D/g, '')
        if (!telefone && dig.length >= 8) {
          telefone = dig
          continue
        }
        const n = Number(c)
        if (dia === undefined && /^\d{1,2}$/.test(c) && n >= 1 && n <= 31) {
          dia = n
          continue
        }
        if (!nome && c) nome = c
      }
      return telefone ? [{ telefone, nome: nome || undefined, dia }] : []
    })
}

const mesAtual = () => new Date().toISOString().slice(0, 7) // "YYYY-MM" (aproximado p/ badge)

// recorrências (rótulo amigável) + quais campos cada uma usa. [parceiro Item 3]
const RECORRENCIAS: { v: string; label: string }[] = [
  { v: 'uma_vez', label: '📅 Uma vez' },
  { v: 'diario', label: '☀️ Todo dia' },
  { v: 'dias_uteis', label: '💼 Dias úteis (seg–sex)' },
  { v: 'fim_de_semana', label: '🌴 Fim de semana' },
  { v: 'semanal', label: '📆 Semanal (dias)' },
  { v: 'a_cada_dias', label: '🔁 A cada X dias' },
  { v: 'a_cada_semanas', label: '🔁 A cada X semanas' },
  { v: 'mensal', label: '🗓️ Todo mês (dia)' },
  { v: 'a_cada_meses', label: '🔁 A cada X meses' },
  { v: 'anual', label: '🎂 Anual' },
]
const usaDiaMes = (r: string) => r === 'mensal' || r === 'a_cada_meses'
const usaDataUnica = (r: string) => r === 'uma_vez' || r === 'anual'
const usaDiasSemana = (r: string) => r === 'semanal' || r === 'a_cada_semanas'
const usaIntervalo = (r: string) => r === 'a_cada_dias' || r === 'a_cada_semanas' || r === 'a_cada_meses'
const unidadeIntervalo = (r: string) => (r === 'a_cada_dias' ? 'dias' : r === 'a_cada_semanas' ? 'semanas' : 'meses')
const DIAS_SEMANA = [
  { n: 1, l: 'Seg' }, { n: 2, l: 'Ter' }, { n: 3, l: 'Qua' }, { n: 4, l: 'Qui' },
  { n: 5, l: 'Sex' }, { n: 6, l: 'Sáb' }, { n: 0, l: 'Dom' },
]
const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const semanaLabel = (csv: string | null) =>
  csv ? csv.split(',').map((s) => NOMES_DIA[Number(s.trim())] ?? '?').join(', ') : 'semanal'
const dataBR = (s: string) => new Date(s).toLocaleDateString('pt-BR')

function quandoLabel(a: Agendamento): string {
  const r = a.recorrencia
  if (r === 'mensal') return `todo dia ${a.diaDoMes}`
  if (r === 'a_cada_meses') return `a cada ${a.intervalo} meses · dia ${a.diaDoMes}`
  if (r === 'uma_vez') return a.dataUnica ? dataBR(a.dataUnica) : '—'
  if (r === 'anual') return a.dataUnica ? `todo ano em ${dataBR(a.dataUnica).slice(0, 5)}` : 'anual'
  if (r === 'diario') return 'todo dia'
  if (r === 'dias_uteis') return 'dias úteis'
  if (r === 'fim_de_semana') return 'fim de semana'
  if (r === 'semanal') return semanaLabel(a.diasSemana)
  if (r === 'a_cada_dias') return `a cada ${a.intervalo} dias`
  if (r === 'a_cada_semanas') return `a cada ${a.intervalo} sem · ${semanaLabel(a.diasSemana)}`
  return '—'
}

function NovoModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    recorrencia: 'mensal' as string,
    diaPadrao: '',
    dataUnica: '',
    intervalo: '1',
    diasSemana: [] as number[],
    horario: '',
    dataInicio: '',
    dataFim: '',
    maxExecucoes: '',
    entrega: 'ia' as 'ia' | 'fixa',
    tipo: 'cobrar',
    objetivo: 'Lembrar o cliente do pagamento em aberto com cordialidade e oferecer o caminho pra regularizar.',
    tom: 'Respeitoso, empático e leve.',
    informacoes: '',
    mensagemFixa: 'Oi! 🙂 Passando só pra lembrar que seu pagamento vence hoje. Qualquer coisa, é só me chamar por aqui.',
    numeroId: '',
    rotulo: '',
    contatos: '',
  })

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const c = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (c) setForm((f) => ({ ...f, numeroId: c.id }))
    })
  }, [])

  const onCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const txt = await file.text()
    setForm((f) => ({ ...f, contatos: (f.contatos ? f.contatos + '\n' : '') + txt.trim() }))
  }

  const criar = async () => {
    if (!form.numeroId) return toast('Cadastre/conecte um número primeiro.', 'erro')
    const contatos = parseLinhas(form.contatos)
    if (contatos.length === 0) return toast('Informe ao menos um contato (telefone por linha).', 'erro')
    const r = form.recorrencia
    if (usaDiaMes(r)) {
      const semDia = contatos.filter((c) => c.dia === undefined)
      if (semDia.length > 0 && !form.diaPadrao) return toast('Defina o "dia do mês" (padrão ou por linha).', 'erro')
    }
    if (usaDataUnica(r) && !form.dataUnica) return toast('Escolha a data.', 'erro')
    if (usaDiasSemana(r) && form.diasSemana.length === 0) return toast('Escolha ao menos um dia da semana.', 'erro')
    if (usaIntervalo(r) && (!form.intervalo || Number(form.intervalo) < 1)) return toast('Informe o intervalo (a cada X).', 'erro')
    if (form.horario && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.horario)) return toast('Horário inválido (use HH:mm).', 'erro')
    if (form.entrega === 'fixa' && !form.mensagemFixa.trim()) return toast('Escreva a mensagem fixa.', 'erro')
    if (form.entrega === 'ia' && !form.objetivo.trim()) return toast('Descreva o objetivo.', 'erro')
    setSalvando(true)
    try {
      const { criados, ignorados } = await api.agendamentos.criarLote({
        numeroId: form.numeroId,
        tipo: form.tipo,
        modo: 'auto',
        objetivo: form.objetivo.trim() || undefined,
        tom: form.tom.trim() || undefined,
        informacoes: form.informacoes.trim() || undefined,
        recorrencia: r,
        diaDoMes: usaDiaMes(r) && form.diaPadrao ? Number(form.diaPadrao) : undefined,
        dataUnica: usaDataUnica(r) ? form.dataUnica : undefined,
        intervalo: usaIntervalo(r) ? Number(form.intervalo) : undefined,
        diasSemana: usaDiasSemana(r) ? form.diasSemana : undefined,
        horario: form.horario.trim() || undefined,
        dataInicio: form.dataInicio || undefined,
        dataFim: form.dataFim || undefined,
        maxExecucoes: form.maxExecucoes ? Number(form.maxExecucoes) : undefined,
        entrega: form.entrega,
        mensagemFixa: form.entrega === 'fixa' ? form.mensagemFixa.trim() : undefined,
        rotulo: form.rotulo.trim() || undefined,
        contatos,
      })
      toast(`${criados} agendamento${criados === 1 ? '' : 's'} criado${criados === 1 ? '' : 's'}${ignorados ? ` · ${ignorados} ignorado(s)` : ''}.`, 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-content">Novo agendamento</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Recorrência</label>
            <select value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value })} className={campo}>
              {RECORRENCIAS.map((r) => (<option key={r.v} value={r.v} className="bg-slate-900">{r.label}</option>))}
            </select>
          </div>
          {/* campos que só aparecem quando o tipo precisa */}
          {usaIntervalo(form.recorrencia) && (
            <div>
              <label className="mb-1 block text-xs text-muted">A cada</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={form.intervalo} onChange={(e) => setForm({ ...form, intervalo: e.target.value })} className={cn(campo, 'w-24')} />
                <span className="text-sm text-muted">{unidadeIntervalo(form.recorrencia)}</span>
              </div>
            </div>
          )}
          {usaDiasSemana(form.recorrencia) && (
            <div>
              <label className="mb-1 block text-xs text-muted">Dias da semana</label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d) => {
                  const on = form.diasSemana.includes(d.n)
                  return (
                    <button key={d.n} type="button" onClick={() => setForm({ ...form, diasSemana: on ? form.diasSemana.filter((x) => x !== d.n) : [...form.diasSemana, d.n] })} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', on ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
                      {d.l}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {usaDiaMes(form.recorrencia) && (
            <div>
              <label className="mb-1 block text-xs text-muted">Dia do mês (padrão) <span className="text-subtle">— dá pra sobrescrever por linha</span></label>
              <input type="number" min={1} max={31} value={form.diaPadrao} onChange={(e) => setForm({ ...form, diaPadrao: e.target.value })} placeholder="Ex.: 27" className={campo} />
            </div>
          )}
          {usaDataUnica(form.recorrencia) && (
            <div>
              <label className="mb-1 block text-xs text-muted">{form.recorrencia === 'anual' ? 'Data de referência (dia/mês)' : 'Data do disparo'}</label>
              <input type="date" value={form.dataUnica} onChange={(e) => setForm({ ...form, dataUnica: e.target.value })} className={campo} />
            </div>
          )}
          {form.recorrencia !== 'uma_vez' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Horário (opcional)</label>
                <input value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="Ex.: 09:00" className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Parar após (opcional)</label>
                <input type="number" min={1} value={form.maxExecucoes} onChange={(e) => setForm({ ...form, maxExecucoes: e.target.value })} placeholder="nº de vezes" className={campo} />
              </div>
              {usaIntervalo(form.recorrencia) && (
                <div>
                  <label className="mb-1 block text-xs text-muted">Início (opcional)</label>
                  <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className={campo} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-muted">Até (opcional)</label>
                <input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} className={campo} />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted">No dia</label>
            <div className="flex gap-1.5">
              {(['ia', 'fixa'] as const).map((en) => (
                <button key={en} onClick={() => setForm({ ...form, entrega: en })} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.entrega === en ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
                  {en === 'ia' ? '🤖 IA conduz' : '✉️ Mensagem fixa'}
                </button>
              ))}
            </div>
          </div>
          {form.entrega === 'ia' ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_MISSAO.map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, tipo: t })} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.tipo === t ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
                      {TIPO_INFO[t].emoji} {TIPO_INFO[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Objetivo</label>
                <textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} className={cn(campo, 'resize-none')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Tom (opcional)</label>
                <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Informações autorizadas (opcional)</label>
                <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} placeholder="Valor, vencimento, chave PIX… (a IA só afirma o que estiver aqui)" className={cn(campo, 'resize-none')} />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-muted">Mensagem fixa (enviada no dia)</label>
              <textarea value={form.mensagemFixa} onChange={(e) => setForm({ ...form, mensagemFixa: e.target.value })} rows={3} className={cn(campo, 'resize-none')} />
              <p className="mt-1 text-[11px] leading-snug text-muted">Se o cliente responder, cai pra você (a IA fica de fora nesse modo).</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted">Número (chip)</label>
            <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
              {numeros.length === 0 && <option value="">— nenhum número —</option>}
              {numeros.map((n) => (<option key={n.id} value={n.id} className="bg-slate-900">{rotuloNumero(n)}{n.apelido ? ` · +${n.telefone}` : ''} ({n.statusConexao})</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Rótulo (opcional)</label>
            <input value={form.rotulo} onChange={(e) => setForm({ ...form, rotulo: e.target.value })} placeholder="Ex.: Mensalidade" className={campo} />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Clientes <span className="text-subtle">— telefone, nome, dia (um por linha)</span></span>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200"><Upload className="h-3 w-3" /> CSV</button>
            </label>
            <textarea value={form.contatos} onChange={(e) => setForm({ ...form, contatos: e.target.value })} rows={4} placeholder={'5583999998888, João, 27\n5511988887777, Maria, 05'} className={cn(campo, 'resize-none font-mono text-[13px]')} />
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onCSV} className="hidden" />
            <p className="mt-1 text-[11px] leading-snug text-muted">🚀 Cada cliente vira um agendamento. Na recorrência mensal, o "dia" da linha manda; sem ele, usa o dia padrão.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>Agendar</Button>
        </div>
      </Card>
    </div>
  )
}

function EditarModal({ ag, onFechar }: { ag: Agendamento; onFechar: (salvou: boolean) => void }) {
  const [dia, setDia] = useState(String(ag.diaDoMes ?? ''))
  const [rotulo, setRotulo] = useState(ag.rotulo ?? '')
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    setSalvando(true)
    try {
      await api.agendamentos.editar(ag.id, {
        diaDoMes: ag.recorrencia === 'mensal' && dia ? Number(dia) : undefined,
        rotulo: rotulo.trim(),
      })
      toast('Agendamento atualizado.', 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-content">Editar agendamento</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          {ag.recorrencia === 'mensal' && (
            <div>
              <label className="mb-1 block text-xs text-muted">Dia do mês</label>
              <input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted">Rótulo</label>
            <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className={campo} />
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

export function Programadas() {
  const [lista, setLista] = useState<Agendamento[] | null>(null)
  const [modal, setModal] = useState(false)
  const [editar, setEditar] = useState<Agendamento | null>(null)

  const carregar = () => api.agendamentos.listar().then(setLista).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const acao = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast(ok, 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Cobranças e lembretes que disparam sozinhos — cada cliente no seu dia (ou numa data única).</p>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Novo agendamento</Button>
      </div>

      {lista === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : lista.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} titulo="Nenhum agendamento" texto="Programe uma cobrança recorrente (ex.: cliente todo dia 27) ou um lembrete pontual." acao={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Novo agendamento</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">No dia</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const puladoAgora = !!a.pularCicloRef && a.pularCicloRef === (a.recorrencia === 'mensal' ? mesAtual() : a.dataUnica?.slice(0, 10))
                return (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface2">
                    <td className="px-4 py-3">
                      <span className="font-medium text-content">{a.contato.nome ?? `+${a.contato.telefone}`}</span>
                      {a.rotulo && <span className="ml-2 rounded bg-surface2 px-1.5 text-[10px] text-muted">{a.rotulo}</span>}
                      {a.contato.optOut && <span className="ml-2 rounded bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-300">opt-out</span>}
                    </td>
                    <td className="px-4 py-3 text-content">
                      {quandoLabel(a)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-surface2 px-2 py-0.5 text-xs text-content">{a.entrega === 'ia' ? `🤖 ${TIPO_INFO[a.tipo as keyof typeof TIPO_INFO]?.label ?? a.tipo}` : '✉️ Msg fixa'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {!a.ativo ? (
                        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">pausado</span>
                      ) : puladoAgora ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">pulado este ciclo</span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {a.ativo && a.recorrencia === 'mensal' && !puladoAgora && (
                          <button title="Marcar como pago / pular este mês" onClick={() => acao(() => api.agendamentos.pular(a.id), 'Vai pular este ciclo.')} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-emerald-300"><Wallet className="h-4 w-4" /></button>
                        )}
                        <button title={a.ativo ? 'Pausar' : 'Ativar'} onClick={() => acao(() => api.agendamentos.editar(a.id, { ativo: !a.ativo }), a.ativo ? 'Pausado.' : 'Ativado.')} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-content">{a.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                        <button title="Editar" onClick={() => setEditar(a)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-content"><Pencil className="h-4 w-4" /></button>
                        <button title="Remover" onClick={() => { if (confirm('Remover este agendamento?')) acao(() => api.agendamentos.remover(a.id), 'Removido.') }} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && <NovoModal onFechar={(c) => { setModal(false); if (c) carregar() }} />}
      {editar && <EditarModal ag={editar} onFechar={(s) => { setEditar(null); if (s) carregar() }} />}
    </div>
  )
}
