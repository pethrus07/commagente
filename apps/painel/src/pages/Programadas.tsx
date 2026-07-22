import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2, Upload, Wallet, X } from 'lucide-react'
import { api } from '../lib/api'
import { TIPO_INFO, TIPOS_MISSAO } from '../lib/estados'
import { toast } from '../lib/toast'
import type { Agendamento, Numero } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none'

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

function quandoLabel(a: Agendamento): string {
  if (a.recorrencia === 'mensal') return `todo dia ${a.diaDoMes}`
  if (a.dataUnica) return new Date(a.dataUnica).toLocaleDateString('pt-BR')
  return '—'
}

function NovoModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    recorrencia: 'mensal' as 'mensal' | 'uma_vez',
    diaPadrao: '',
    dataUnica: '',
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
    if (form.recorrencia === 'mensal') {
      const semDia = contatos.filter((c) => c.dia === undefined)
      if (semDia.length > 0 && !form.diaPadrao) return toast('Defina o "dia do mês" (padrão ou por linha).', 'erro')
    }
    if (form.recorrencia === 'uma_vez' && !form.dataUnica) return toast('Escolha a data do disparo.', 'erro')
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
        recorrencia: form.recorrencia,
        diaDoMes: form.recorrencia === 'mensal' && form.diaPadrao ? Number(form.diaPadrao) : undefined,
        dataUnica: form.recorrencia === 'uma_vez' ? form.dataUnica : undefined,
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
          <h3 className="font-semibold text-white">Novo agendamento</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Recorrência</label>
            <div className="flex gap-1.5">
              {(['mensal', 'uma_vez'] as const).map((r) => (
                <button key={r} onClick={() => setForm({ ...form, recorrencia: r })} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.recorrencia === r ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-slate-400 ring-white/10 hover:text-slate-200')}>
                  {r === 'mensal' ? '🔁 Todo mês' : '📅 Uma vez'}
                </button>
              ))}
            </div>
          </div>
          {form.recorrencia === 'mensal' ? (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Dia do mês (padrão) <span className="text-slate-600">— dá pra sobrescrever por linha</span></label>
              <input type="number" min={1} max={31} value={form.diaPadrao} onChange={(e) => setForm({ ...form, diaPadrao: e.target.value })} placeholder="Ex.: 27" className={campo} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Data do disparo</label>
              <input type="date" value={form.dataUnica} onChange={(e) => setForm({ ...form, dataUnica: e.target.value })} className={campo} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-400">No dia</label>
            <div className="flex gap-1.5">
              {(['ia', 'fixa'] as const).map((en) => (
                <button key={en} onClick={() => setForm({ ...form, entrega: en })} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.entrega === en ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-slate-400 ring-white/10 hover:text-slate-200')}>
                  {en === 'ia' ? '🤖 IA conduz' : '✉️ Mensagem fixa'}
                </button>
              ))}
            </div>
          </div>
          {form.entrega === 'ia' ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_MISSAO.map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, tipo: t })} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.tipo === t ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-slate-400 ring-white/10 hover:text-slate-200')}>
                      {TIPO_INFO[t].emoji} {TIPO_INFO[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Objetivo</label>
                <textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} className={cn(campo, 'resize-none')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Tom (opcional)</label>
                <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Informações autorizadas (opcional)</label>
                <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} placeholder="Valor, vencimento, chave PIX… (a IA só afirma o que estiver aqui)" className={cn(campo, 'resize-none')} />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Mensagem fixa (enviada no dia)</label>
              <textarea value={form.mensagemFixa} onChange={(e) => setForm({ ...form, mensagemFixa: e.target.value })} rows={3} className={cn(campo, 'resize-none')} />
              <p className="mt-1 text-[11px] leading-snug text-slate-500">Se o cliente responder, cai pra você (a IA fica de fora nesse modo).</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-400">Número (chip)</label>
            <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
              {numeros.length === 0 && <option value="">— nenhum número —</option>}
              {numeros.map((n) => (<option key={n.id} value={n.id} className="bg-slate-900">+{n.telefone} ({n.statusConexao})</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Rótulo (opcional)</label>
            <input value={form.rotulo} onChange={(e) => setForm({ ...form, rotulo: e.target.value })} placeholder="Ex.: Mensalidade" className={campo} />
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Clientes <span className="text-slate-600">— telefone, nome, dia (um por linha)</span></span>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200"><Upload className="h-3 w-3" /> CSV</button>
            </label>
            <textarea value={form.contatos} onChange={(e) => setForm({ ...form, contatos: e.target.value })} rows={4} placeholder={'5583999998888, João, 27\n5511988887777, Maria, 05'} className={cn(campo, 'resize-none font-mono text-[13px]')} />
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onCSV} className="hidden" />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">🚀 Cada cliente vira um agendamento. Na recorrência mensal, o "dia" da linha manda; sem ele, usa o dia padrão.</p>
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
          <h3 className="font-semibold text-white">Editar agendamento</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          {ag.recorrencia === 'mensal' && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Dia do mês</label>
              <input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-400">Rótulo</label>
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
        <p className="text-sm text-slate-400">Cobranças e lembretes que disparam sozinhos — cada cliente no seu dia (ou numa data única).</p>
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
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-wide text-slate-500">
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
                  <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-100">{a.contato.nome ?? `+${a.contato.telefone}`}</span>
                      {a.rotulo && <span className="ml-2 rounded bg-white/5 px-1.5 text-[10px] text-slate-400">{a.rotulo}</span>}
                      {a.contato.optOut && <span className="ml-2 rounded bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-300">opt-out</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {quandoLabel(a)}
                      <span className="ml-1 text-[11px] text-slate-500">{a.recorrencia === 'mensal' ? '(mensal)' : '(uma vez)'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300">{a.entrega === 'ia' ? `🤖 ${TIPO_INFO[a.tipo as keyof typeof TIPO_INFO]?.label ?? a.tipo}` : '✉️ Msg fixa'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {!a.ativo ? (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">pausado</span>
                      ) : puladoAgora ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">pulado este ciclo</span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {a.ativo && a.recorrencia === 'mensal' && !puladoAgora && (
                          <button title="Marcar como pago / pular este mês" onClick={() => acao(() => api.agendamentos.pular(a.id), 'Vai pular este ciclo.')} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-emerald-300"><Wallet className="h-4 w-4" /></button>
                        )}
                        <button title={a.ativo ? 'Pausar' : 'Ativar'} onClick={() => acao(() => api.agendamentos.editar(a.id, { ativo: !a.ativo }), a.ativo ? 'Pausado.' : 'Ativado.')} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-100">{a.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                        <button title="Editar" onClick={() => setEditar(a)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-100"><Pencil className="h-4 w-4" /></button>
                        <button title="Remover" onClick={() => { if (confirm('Remover este agendamento?')) acao(() => api.agendamentos.remover(a.id), 'Removido.') }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
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
