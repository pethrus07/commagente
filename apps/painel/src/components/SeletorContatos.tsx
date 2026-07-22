import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../lib/api'
import { parseContatos } from '../lib/contatos'
import type { ContatoResumo } from '../lib/types'
import { cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none'

// Seletor reutilizável: escolher da base (busca + checkbox) + colar novos.
// Emite pra fora a lista combinada (sem duplicar telefone) via onChange.
export function SeletorContatos({
  onChange,
}: {
  onChange: (contatos: { telefone: string; nome?: string }[]) => void
}) {
  const [base, setBase] = useState<ContatoResumo[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [colados, setColados] = useState('')

  useEffect(() => {
    api.contatos
      .listar()
      .then((cs) => setBase(cs.filter((c) => !c.optOut)))
      .catch(() => {})
  }, [])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return base
    return base.filter((c) => (c.nome ?? '').toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '')))
  }, [base, busca])

  const combinados = useMemo(() => {
    const daBase = base.filter((c) => sel.has(c.id)).map((c) => ({ telefone: c.telefone, nome: c.nome ?? undefined }))
    const novos = parseContatos(colados)
    const vistos = new Set<string>()
    return [...daBase, ...novos].filter((c) => (vistos.has(c.telefone) ? false : vistos.add(c.telefone)))
  }, [base, sel, colados])

  useEffect(() => {
    onChange(combinados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinados])

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Escolher da base</span>
          {combinados.length > 0 && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              {combinados.length} no total
            </span>
          )}
        </label>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contato…" className={campo} />
        <div className="mt-1.5 max-h-40 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10">
          {base.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-600">Base vazia — importe na aba Contatos, ou cole abaixo.</p>
          ) : filtrada.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-600">Nenhum contato encontrado.</p>
          ) : (
            filtrada.slice(0, 60).map((c) => (
              <button key={c.id} type="button" onClick={() => alternar(c.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5">
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', sel.has(c.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-white/25')}>
                  {sel.has(c.id) && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate text-sm text-slate-200">{c.nome ?? `+${c.telefone}`}</span>
                {c.nome && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-500">+{c.telefone}</span>}
              </button>
            ))
          )}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Ou cole novos números <span className="text-slate-600">— telefone[, nome] por linha</span></label>
        <textarea value={colados} onChange={(e) => setColados(e.target.value)} rows={2} placeholder={'5583999998888, Fornecedor A'} className={cn(campo, 'resize-none font-mono text-[13px]')} />
      </div>
    </div>
  )
}
