import { useEffect, useState } from 'react'
import { Pencil, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { TagResumo } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

const CORES = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

function TagModal({ tag, onFechar }: { tag: TagResumo | null; onFechar: (mudou: boolean) => void }) {
  const editando = !!tag
  const [form, setForm] = useState({
    nome: tag?.nome ?? '',
    cor: tag?.cor ?? CORES[0],
    descricao: tag?.descricao ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.nome.trim()) return toast('Dê um nome à tag.', 'erro')
    setSalvando(true)
    try {
      if (editando) {
        await api.tags.editar(tag!.id, { nome: form.nome.trim(), cor: form.cor, descricao: form.descricao })
      } else {
        await api.tags.criar({ nome: form.nome.trim(), cor: form.cor, descricao: form.descricao })
      }
      toast('Tag salva.', 'ok')
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
          <h3 className="font-semibold text-content">{editando ? 'Editar tag' : 'Nova tag'}</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Cliente VIP, Fabricante de Máquinas" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })} className={cn('h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition', form.cor === c ? 'ring-content' : 'ring-transparent')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Descrição — vira conhecimento pra IA</label>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} placeholder='Ex.: "Este contato fabrica máquinas industriais. Priorize soluções de automação, retrofit e adequação NR12."' className={cn(campo, 'resize-none')} maxLength={2000} />
            <p className="mt-1 text-[11px] leading-snug text-muted">A IA lê esta descrição em toda conversa com contatos que tenham esta tag — é uma camada de contexto sobre a pessoa (não substitui a identidade/informações da empresa).</p>
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

export function Tags() {
  const [tags, setTags] = useState<TagResumo[] | null>(null)
  const [modal, setModal] = useState<{ tag: TagResumo | null } | null>(null)

  const carregar = () => api.tags.listar().then(setTags).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const remover = async (t: TagResumo) => {
    if (!confirm(`Remover a tag "${t.nome}"? Os contatos perdem essa marcação.`)) return
    try {
      await api.tags.remover(t.id)
      toast('Tag removida.', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Rótulos que organizam contatos <b className="text-content">e</b> viram contexto pra IA — a descrição da tag entra na conversa.</p>
        <Button onClick={() => setModal({ tag: null })}><Plus className="h-4 w-4" /> Nova tag</Button>
      </div>

      {tags === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : tags.length === 0 ? (
        <EmptyState icon={<TagIcon className="h-6 w-6" />} titulo="Nenhuma tag" texto="Crie tags com descrição pra IA tratar cada tipo de contato do jeito certo." acao={<Button onClick={() => setModal({ tag: null })}><Plus className="h-4 w-4" /> Nova tag</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tags.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.cor ?? '#64748b' }} />
                  <p className="truncate font-medium text-content">{t.nome}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setModal({ tag: t })} className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-content" title="Editar"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remover(t)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400" title="Remover"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className={cn('mt-2 flex-1 text-sm', t.descricao ? 'text-muted' : 'text-subtle italic')}>
                {t.descricao || 'Sem descrição — a IA não usa esta tag como contexto ainda.'}
              </p>
              <p className="mt-3 text-[11px] text-muted tabular-nums">{t.total} contato{t.total === 1 ? '' : 's'}</p>
            </Card>
          ))}
        </div>
      )}

      {modal && <TagModal tag={modal.tag} onFechar={(mudou) => { setModal(null); if (mudou) carregar() }} />}
    </div>
  )
}
