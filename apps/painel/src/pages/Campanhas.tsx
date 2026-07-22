import { useEffect, useState } from 'react'
import { Megaphone, Plus, UserPlus, X } from 'lucide-react'
import { SeletorContatos } from '../components/SeletorContatos'
import { api } from '../lib/api'
import { TIPO_INFO, TIPOS_MISSAO } from '../lib/estados'
import { toast } from '../lib/toast'
import type { CampanhaResumo, Numero } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none'

function NovaCampanhaModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [form, setForm] = useState({ nome: '', numeroId: '', tipo: 'vender', objetivo: '', criterioConclusao: '', tom: '', informacoes: '' })
  const [contatos, setContatos] = useState<{ telefone: string; nome?: string }[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const c = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (c) setForm((f) => ({ ...f, numeroId: c.id }))
    })
  }, [])

  const criar = async () => {
    if (!form.nome.trim()) return toast('Dê um nome à campanha.', 'erro')
    if (!form.numeroId) return toast('Escolha um número.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo.', 'erro')
    if (contatos.length === 0) return toast('Escolha ao menos um contato.', 'erro')
    setSalvando(true)
    try {
      const { criadas } = await api.campanhas.criar({
        nome: form.nome.trim(),
        numeroId: form.numeroId,
        tipo: form.tipo,
        objetivo: form.objetivo.trim(),
        criterioConclusao: form.criterioConclusao.trim() || undefined,
        tom: form.tom.trim() || undefined,
        informacoes: form.informacoes.trim() || undefined,
        contatos,
      })
      toast(`Campanha criada — ${criadas} conversa${criadas === 1 ? '' : 's'}.`, 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-white">Nova campanha</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nome da campanha</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Cobrança julho · Prospecção fornecedores" className={campo} />
          </div>
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
            <label className="mb-1 block text-xs text-slate-400">Número (chip)</label>
            <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
              {numeros.length === 0 && <option value="">— nenhum número —</option>}
              {numeros.map((n) => (<option key={n.id} value={n.id} className="bg-slate-900">+{n.telefone} ({n.statusConexao})</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Objetivo</label>
            <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="O que a IA deve fazer em cada conversa" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Critério de conclusão (opcional)</label>
            <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} placeholder="Ex.: pagamento confirmado" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Informações autorizadas (opcional)</label>
            <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} placeholder="Preços/prazos REAIS que a IA pode afirmar" className={cn(campo, 'resize-none')} />
          </div>
          <div className="border-t border-white/8 pt-3">
            <SeletorContatos onChange={setContatos} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>{contatos.length > 1 ? `Disparar (${contatos.length})` : 'Criar campanha'}</Button>
        </div>
      </Card>
    </div>
  )
}

function AddContatosModal({ campanha, onFechar }: { campanha: CampanhaResumo; onFechar: (add: boolean) => void }) {
  const [contatos, setContatos] = useState<{ telefone: string; nome?: string }[]>([])
  const [salvando, setSalvando] = useState(false)
  const adicionar = async () => {
    if (contatos.length === 0) return toast('Escolha ao menos um contato.', 'erro')
    setSalvando(true)
    try {
      const { criadas } = await api.campanhas.adicionarContatos(campanha.id, contatos)
      toast(`${criadas} contato${criadas === 1 ? '' : 's'} adicionado${criadas === 1 ? '' : 's'} à campanha.`, 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-white">Adicionar contatos</h3>
          <button onClick={() => onFechar(false)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-slate-500">à campanha <b className="text-slate-300">{campanha.nome}</b> — cada um vira uma nova conversa com a mesma definição.</p>
        <SeletorContatos onChange={setContatos} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={adicionar} loading={salvando}><UserPlus className="h-4 w-4" /> Adicionar {contatos.length > 0 ? `(${contatos.length})` : ''}</Button>
        </div>
      </Card>
    </div>
  )
}

export function Campanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaResumo[] | null>(null)
  const [modal, setModal] = useState(false)
  const [add, setAdd] = useState<CampanhaResumo | null>(null)

  const carregar = () =>
    api.campanhas.listar().then(setCampanhas).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Uma definição de missão disparada pra vários contatos — dá pra adicionar mais a qualquer momento.</p>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova campanha</Button>
      </div>

      {campanhas === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : campanhas.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-6 w-6" />} titulo="Nenhuma campanha" texto="Crie uma campanha e dispare a mesma missão pra vários contatos de uma vez." acao={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nova campanha</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((c) => {
            const taxa = c.total > 0 ? Math.round((c.cumpridas / c.total) * 100) : 0
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Megaphone className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{c.nome}</p>
                    <p className="truncate text-xs text-slate-500">{TIPO_INFO[c.tipo]?.emoji} {TIPO_INFO[c.tipo]?.label} · {tempoRelativo(c.criadoEm)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-300">{c.objetivo}</p>
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="text-slate-200"><b className="tabular-nums">{c.total}</b> <span className="text-slate-500">conversas</span></span>
                  <span className="text-emerald-300"><b className="tabular-nums">{c.cumpridas}</b> <span className="text-emerald-300/60">cumpridas</span></span>
                  <span className="ml-auto text-xs text-slate-500 tabular-nums">{taxa}%</span>
                </div>
                <Button variant="ghost" className="mt-4 w-full" onClick={() => setAdd(c)}><UserPlus className="h-4 w-4" /> Adicionar contatos</Button>
              </Card>
            )
          })}
        </div>
      )}

      {modal && <NovaCampanhaModal onFechar={(criou) => { setModal(false); if (criou) carregar() }} />}
      {add && <AddContatosModal campanha={add} onFechar={(a) => { setAdd(null); if (a) carregar() }} />}
    </div>
  )
}
