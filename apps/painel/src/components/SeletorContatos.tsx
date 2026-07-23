import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../lib/api'
import { parseContatos } from '../lib/contatos'
import type { ContatoResumo, TagResumo } from '../lib/types'
import { cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

// Seletor reutilizável: escolher da base (busca + checkbox) + colar novos.
// Emite pra fora a lista combinada (sem duplicar telefone) via onChange.
export function SeletorContatos({
  onChange,
}: {
  onChange: (contatos: { telefone: string; nome?: string }[]) => void
}) {
  const [base, setBase] = useState<ContatoResumo[]>([])
  const [tags, setTags] = useState<TagResumo[]>([])
  const [filtroTag, setFiltroTag] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [colados, setColados] = useState('')

  useEffect(() => {
    api.contatos
      .listar()
      .then((cs) => setBase(cs.filter((c) => !c.optOut)))
      .catch(() => {})
    api.tags.listar().then(setTags).catch(() => {})
  }, [])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const digitos = q.replace(/\D/g, '')
    return base.filter((c) => {
      // filtro por tag (ex.: disparar pra "todos da tag costa-doce")
      if (filtroTag && !c.tags.some((t) => t.id === filtroTag)) return false
      if (!q) return true
      // sem este guard, digitos='' e telefone.includes('') casa TODOS os contatos
      return (c.nome ?? '').toLowerCase().includes(q) || (digitos.length > 0 && c.telefone.includes(digitos))
    })
  }, [base, busca, filtroTag])

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

  // "selecionar todos" opera sobre o que está VISÍVEL (respeita a busca)
  const todosVisiveisSelecionados = filtrada.length > 0 && filtrada.every((c) => sel.has(c.id))
  const alternarTodos = () =>
    setSel((s) => {
      const n = new Set(s)
      if (todosVisiveisSelecionados) filtrada.forEach((c) => n.delete(c.id))
      else filtrada.forEach((c) => n.add(c.id))
      return n
    })

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Escolher da base</span>
          {combinados.length > 0 && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              {combinados.length} no total
            </span>
          )}
        </label>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contato…" className={campo} />
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted">Tag:</span>
            <button type="button" onClick={() => setFiltroTag(null)} className={cn('rounded-full border px-2 py-0.5 text-[11px]', filtroTag === null ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300' : 'border-line text-muted hover:text-content')}>todas</button>
            {tags.map((t) => (
              <button key={t.id} type="button" onClick={() => setFiltroTag(filtroTag === t.id ? null : t.id)} className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', filtroTag === t.id ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300' : 'border-line text-muted hover:text-content')}>
                {t.nome} <span className="opacity-60">{t.total}</span>
              </button>
            ))}
          </div>
        )}
        {base.length > 0 && (
          <div className="mt-1.5 flex items-center justify-between px-0.5">
            <span className="text-[11px] text-muted">
              {filtroTag || busca.trim() ? `${filtrada.length} no filtro` : `${base.length} na base`}
            </span>
            <button type="button" onClick={alternarTodos} className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200">
              {todosVisiveisSelecionados ? 'Limpar seleção' : `Selecionar todos${busca.trim() || filtroTag ? ' do filtro' : ''}`}
            </button>
          </div>
        )}
        <div className="mt-1.5 max-h-40 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {base.length === 0 ? (
            <p className="px-3 py-3 text-xs text-subtle">Base vazia — importe na aba Contatos, ou cole abaixo.</p>
          ) : filtrada.length === 0 ? (
            <p className="px-3 py-3 text-xs text-subtle">Nenhum contato encontrado.</p>
          ) : (
            filtrada.slice(0, 60).map((c) => (
              <button key={c.id} type="button" onClick={() => alternar(c.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface2">
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', sel.has(c.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-line-strong')}>
                  {sel.has(c.id) && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate text-sm text-content">{c.nome ?? `+${c.telefone}`}</span>
                {c.nome && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted">+{c.telefone}</span>}
              </button>
            ))
          )}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Ou cole novos números <span className="text-subtle">— telefone[, nome] por linha</span></label>
        <textarea value={colados} onChange={(e) => setColados(e.target.value)} rows={2} placeholder={'5583999998888, Fornecedor A'} className={cn(campo, 'resize-none font-mono text-[13px]')} />
      </div>
    </div>
  )
}
