import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Conhecimento as Item } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

function ItemModal({
  inicial,
  onFechar,
}: {
  inicial?: Item
  onFechar: (mudou: boolean) => void
}) {
  const [form, setForm] = useState({
    titulo: inicial?.titulo ?? '',
    conteudo: inicial?.conteudo ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return toast('Preencha título e conteúdo.', 'erro')
    setSalvando(true)
    try {
      if (inicial) {
        await api.conhecimento.editar(inicial.id, { titulo: form.titulo.trim(), conteudo: form.conteudo.trim() })
        toast('Conhecimento atualizado.', 'ok')
      } else {
        await api.conhecimento.criar({ titulo: form.titulo.trim(), conteudo: form.conteudo.trim() })
        toast('Conhecimento adicionado.', 'ok')
      }
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-content">{inicial ? 'Editar conhecimento' : 'Novo conhecimento'}</h3>
          <button onClick={() => onFechar(false)} className="text-subtle hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Título</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Objeção de preço" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Conteúdo</label>
            <textarea value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} rows={4} placeholder="Ex.: Quando acham caro, reforçar o ROI: economiza X horas/semana." className={cn(campo, 'resize-none')} />
          </div>
          <p className="text-[11px] leading-snug text-subtle">
            A IA consulta os itens <b>aprovados</b> ao responder. Não coloque preço aqui se ele não puder ser afirmado (isso é a "informação autorizada" da missão).
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={salvar} loading={salvando}>Salvar</Button>
        </div>
      </Card>
    </div>
  )
}

export function Conhecimento() {
  const [itens, setItens] = useState<Item[] | null>(null)
  const [modal, setModal] = useState<{ inicial?: Item } | null>(null)

  const carregar = () =>
    api.conhecimento.listar().then(setItens).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const { sugeridos, aprovados } = useMemo(() => {
    const l = itens ?? []
    return {
      sugeridos: l.filter((i) => i.status === 'sugerido'),
      aprovados: l.filter((i) => i.status === 'aprovado'),
    }
  }, [itens])

  const status = async (id: string, s: 'aprovado' | 'rejeitado') => {
    try {
      await api.conhecimento.status(id, s)
      toast(s === 'aprovado' ? 'Aprovado — a IA já pode usar.' : 'Sugestão descartada.', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  const excluir = async (id: string) => {
    try {
      await api.conhecimento.excluir(id)
      toast('Removido.', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  if (itens === null) {
    return <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">O que a IA aprende com as conversas. Ela consulta os aprovados ao responder.</p>
        <Button onClick={() => setModal({})}><Plus className="h-4 w-4" /> Novo</Button>
      </div>

      {/* Sugestões da IA (aguardam curadoria) */}
      {sugeridos.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-content">Sugerido pela IA</h3>
            <span className="rounded-full bg-violet-500/20 px-2 text-[11px] font-medium text-violet-700 dark:text-violet-300">{sugeridos.length}</span>
          </div>
          {sugeridos.map((i) => (
            <Card key={i.id} className="border-violet-500/25 bg-violet-500/[0.06] p-4">
              <p className="text-sm text-content">{i.conteudo}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={() => status(i.id, 'aprovado')}><Check className="h-4 w-4" /> Aprovar</Button>
                <Button variant="ghost" onClick={() => status(i.id, 'rejeitado')}><X className="h-4 w-4" /> Descartar</Button>
                <span className="ml-auto text-[11px] text-subtle">{tempoRelativo(i.criadoEm)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Base ativa (aprovados) */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-content">Base ativa ({aprovados.length})</h3>
        {aprovados.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            titulo="Base vazia"
            texto="Adicione conhecimento (FAQ, objeções, políticas) ou aprove as sugestões da IA."
          />
        ) : (
          aprovados.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-content">{i.titulo}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{i.conteudo}</p>
                  <p className="mt-1.5 text-[11px] text-subtle">
                    {i.origem === 'ia' ? '🤖 aprendido pela IA' : '✍️ curado'} · {tempoRelativo(i.criadoEm)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setModal({ inicial: i })} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface2 hover:text-content" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => excluir(i.id)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface2 hover:text-rose-500" title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {modal && (
        <ItemModal
          inicial={modal.inicial}
          onFechar={(mudou) => {
            setModal(null)
            if (mudou) carregar()
          }}
        />
      )}
    </div>
  )
}
