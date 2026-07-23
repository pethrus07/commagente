import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Search, Smartphone, Tag as TagIcon, Trash2, Upload, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { ContatoResumo, Numero, Tag, TagResumo } from '../lib/types'
import { Button, Card, EmptyState, Spinner, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

// estilo do "chip" de tag usando a cor (hex) opcional da tag
function estiloTag(cor: string | null) {
  const c = cor || '#6366f1'
  return { backgroundColor: `${c}22`, color: c, borderColor: `${c}55` }
}

// parser tolerante: cada linha vira {telefone, nome?}; pula cabeçalho (linha sem telefone)
function parseCSV(txt: string): { nome?: string; telefone: string }[] {
  return txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => {
      const cols = l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
      let telefone = ''
      let nome = ''
      for (const c of cols) {
        const digitos = c.replace(/\D/g, '')
        if (!telefone && digitos.length >= 8) telefone = digitos
        else if (!nome && c && c.replace(/\D/g, '').length < 8) nome = c
      }
      return telefone ? [{ telefone, nome: nome || undefined }] : []
    })
}

function NovoContatoModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [form, setForm] = useState({ nome: '', telefone: '' })
  const [salvando, setSalvando] = useState(false)
  const criar = async () => {
    if (form.telefone.replace(/\D/g, '').length < 8) return toast('Telefone inválido (DDI+DDD).', 'erro')
    setSalvando(true)
    try {
      await api.contatos.criar({ nome: form.nome.trim() || undefined, telefone: form.telefone.replace(/\D/g, '') })
      toast('Contato salvo.', 'ok')
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
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-content">Novo contato</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nome (opcional)</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Fulano" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Telefone</label>
            <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="5583999998888" className={campo} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>Salvar</Button>
        </div>
      </Card>
    </div>
  )
}

function ImportarWhatsAppModal({ onFechar }: { onFechar: (importou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[] | null>(null)
  const [importando, setImportando] = useState<string | null>(null)
  useEffect(() => {
    api.numeros.listar().then(setNumeros).catch((e) => toast((e as Error).message, 'erro'))
  }, [])
  const importar = async (id: string) => {
    setImportando(id)
    try {
      const r = await api.contatos.importarWhatsApp(id)
      toast(`Agenda importada: ${r.criados} novos, ${r.atualizados} atualizados.`, 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setImportando(null)
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-content">Importar do WhatsApp</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-muted">Puxa a agenda do número conectado. Escolha o chip:</p>
        {numeros === null ? (
          <div className="grid place-items-center py-8"><Spinner className="h-5 w-5" /></div>
        ) : numeros.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum número cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {numeros.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-xl border border-line bg-surface2 px-3 py-2.5">
                <div className="text-sm">
                  <span className="text-content">+{n.telefone}</span>
                  <span className="ml-2 text-xs text-muted">{n.statusConexao}</span>
                </div>
                <Button onClick={() => importar(n.id)} loading={importando === n.id} disabled={n.statusConexao !== 'conectado'}>
                  Importar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// modal p/ criar e excluir tags do tenant
function TagsModal({ tags, onFechar }: { tags: TagResumo[]; onFechar: (mudou: boolean) => void }) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#6366f1')
  const [salvando, setSalvando] = useState(false)
  const [mudou, setMudou] = useState(false)
  const [lista, setLista] = useState(tags)

  const criar = async () => {
    if (!nome.trim()) return
    setSalvando(true)
    try {
      await api.tags.criar({ nome: nome.trim(), cor })
      const nova = await api.tags.listar()
      setLista(nova)
      setNome('')
      setMudou(true)
      toast('Tag criada.', 'ok')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }
  const remover = async (id: string) => {
    try {
      await api.tags.remover(id)
      setLista((l) => l.filter((t) => t.id !== id))
      setMudou(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-content">Tags</h3>
          <button onClick={() => onFechar(mudou)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Nova tag</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} placeholder="ex.: costa-doce" className={campo} />
          </div>
          <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border border-line bg-surface2" title="Cor da tag" />
          <Button onClick={criar} loading={salvando}>Criar</Button>
        </div>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {lista.length === 0 && <p className="py-4 text-center text-sm text-subtle">Nenhuma tag ainda.</p>}
          {lista.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-surface2 px-3 py-2">
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full border px-2 py-0.5 text-xs font-medium" style={estiloTag(t.cor)}>{t.nome}</span>
                <span className="text-xs text-muted">{t.total} contato{t.total === 1 ? '' : 's'}</span>
              </span>
              <button onClick={() => remover(t.id)} className="text-muted hover:text-rose-400" title="Excluir tag"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// mini-dropdown p/ adicionar uma tag existente a um contato
function AdicionarTag({ tags, jaTem, onAplicar }: { tags: TagResumo[]; jaTem: string[]; onAplicar: (tagId: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const disponiveis = tags.filter((t) => !jaTem.includes(t.id))
  return (
    <span className="relative inline-block">
      <button onClick={() => setAberto((v) => !v)} className="grid h-5 w-5 place-items-center rounded-full border border-dashed border-line text-muted hover:border-indigo-500/50 hover:text-content" title="Adicionar tag">
        <Plus className="h-3 w-3" />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute left-0 top-6 z-20 max-h-52 w-44 overflow-y-auto rounded-xl border border-line bg-elevated p-1 shadow-xl">
            {disponiveis.length === 0 ? (
              <p className="px-2 py-2 text-xs text-subtle">Sem tags disponíveis.</p>
            ) : (
              disponiveis.map((t) => (
                <button key={t.id} onClick={() => { onAplicar(t.id); setAberto(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.cor || '#6366f1' }} />
                  <span className="text-content">{t.nome}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </span>
  )
}

export function Contatos() {
  const [contatos, setContatos] = useState<ContatoResumo[] | null>(null)
  const [tags, setTags] = useState<TagResumo[]>([])
  const [busca, setBusca] = useState('')
  const [filtroTag, setFiltroTag] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<'novo' | 'whatsapp' | 'tags' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = () =>
    Promise.all([api.contatos.listar(), api.tags.listar()])
      .then(([cs, ts]) => { setContatos(cs); setTags(ts) })
      .catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => { carregar() }, [])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const digitos = q.replace(/\D/g, '')
    return (contatos ?? []).filter((c) => {
      if (filtroTag && !c.tags.some((t) => t.id === filtroTag)) return false
      if (!q) return true
      return (c.nome ?? '').toLowerCase().includes(q) || (digitos.length > 0 && c.telefone.includes(digitos))
    })
  }, [contatos, busca, filtroTag])

  // atualização otimista de uma linha (evita recarregar tudo ao mexer numa tag)
  const patchContato = (id: string, novasTags: Tag[]) =>
    setContatos((cs) => (cs ?? []).map((c) => (c.id === id ? { ...c, tags: novasTags } : c)))

  const aplicarTagNoContato = async (contatoId: string, tagId: string) => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return
    const alvo = (contatos ?? []).find((c) => c.id === contatoId)
    if (!alvo || alvo.tags.some((t) => t.id === tagId)) return
    patchContato(contatoId, [...alvo.tags, { id: tag.id, nome: tag.nome, cor: tag.cor }])
    try {
      await api.contatos.aplicarTag(contatoId, tagId)
    } catch (e) {
      toast((e as Error).message, 'erro'); carregar()
    }
  }
  const removerTagDoContato = async (contatoId: string, tagId: string) => {
    const alvo = (contatos ?? []).find((c) => c.id === contatoId)
    if (!alvo) return
    patchContato(contatoId, alvo.tags.filter((t) => t.id !== tagId))
    try {
      await api.contatos.removerTag(contatoId, tagId)
    } catch (e) {
      toast((e as Error).message, 'erro'); carregar()
    }
  }

  const aplicarEmLote = async (tagId: string) => {
    if (sel.size === 0) return
    try {
      const r = await api.tags.aplicarEmLote(tagId, [...sel])
      toast(`Tag aplicada a ${r.aplicados} contato${r.aplicados === 1 ? '' : 's'}.`, 'ok')
      setSel(new Set())
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  const toggleSel = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTodos = () =>
    setSel((s) => (s.size === visiveis.length ? new Set() : new Set(visiveis.map((c) => c.id))))

  const onCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const linhas = parseCSV(await file.text())
      if (linhas.length === 0) return toast('Nenhum telefone válido no arquivo.', 'erro')
      const r = await api.contatos.importar(linhas)
      toast(`CSV importado: ${r.criados} novos, ${r.atualizados} atualizados, ${r.ignorados} ignorados.`, 'ok')
      carregar()
    } catch (err) {
      toast((err as Error).message, 'erro')
    }
  }

  const exportar = async () => {
    try {
      const csv = await api.contatos.exportarCSV()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'contatos.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 min-w-[220px]">
          <Search className="h-4 w-4 text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone…" className="flex-1 bg-transparent text-sm text-content placeholder:text-subtle focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal('novo')}><Plus className="h-4 w-4" /> Novo</Button>
          <Button variant="ghost" onClick={() => setModal('tags')}><TagIcon className="h-4 w-4" /> Tags</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> CSV</Button>
          <Button variant="ghost" onClick={() => setModal('whatsapp')}><Smartphone className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="ghost" onClick={exportar}><Download className="h-4 w-4" /> Exportar</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onCSV} className="hidden" />
        </div>
      </div>

      {/* filtro por tag */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFiltroTag(null)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filtroTag === null ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300' : 'border-line bg-surface2 text-muted hover:text-content'}`}>Todas</button>
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => setFiltroTag(filtroTag === t.id ? null : t.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filtroTag === t.id ? '' : 'border-line bg-surface2 text-muted hover:text-content'}`}
              style={filtroTag === t.id ? estiloTag(t.cor) : undefined}
            >
              {t.nome} <span className="opacity-60">{t.total}</span>
            </button>
          ))}
        </div>
      )}

      {/* barra de ação em massa */}
      {sel.size > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-indigo-500/30 bg-indigo-500/5 px-4 py-2.5">
          <span className="text-sm text-content">{sel.size} selecionado{sel.size === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Aplicar tag:</span>
            {tags.length === 0 ? (
              <button onClick={() => setModal('tags')} className="text-xs text-indigo-400 hover:underline">criar tag</button>
            ) : (
              tags.map((t) => (
                <button key={t.id} onClick={() => aplicarEmLote(t.id)} className="rounded-full border px-2.5 py-0.5 text-xs font-medium" style={estiloTag(t.cor)}>{t.nome}</button>
              ))
            )}
            <button onClick={() => setSel(new Set())} className="ml-1 text-muted hover:text-content"><X className="h-4 w-4" /></button>
          </div>
        </Card>
      )}

      {contatos === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : contatos.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} titulo="Nenhum contato ainda" texto="Adicione um contato, importe do WhatsApp ou suba um CSV." acao={<Button onClick={() => setModal('novo')}><Plus className="h-4 w-4" /> Novo contato</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={visiveis.length > 0 && sel.size === visiveis.length} onChange={toggleTodos} className="cursor-pointer accent-indigo-500" />
                </th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 text-center font-medium">Missões</th>
                <th className="px-4 py-3 text-right font-medium">Criado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">Nenhum contato encontrado.</td></tr>
              )}
              {visiveis.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface2">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} className="cursor-pointer accent-indigo-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-xs font-semibold text-content">
                        {(c.nome ?? '#').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-content">{c.nome ?? <span className="text-muted">sem nome</span>}</span>
                      {c.optOut && <span className="rounded bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-300">opt-out</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.tags.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={estiloTag(t.cor)}>
                          {t.nome}
                          <button onClick={() => removerTagDoContato(c.id, t.id)} className="opacity-60 hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      ))}
                      <AdicionarTag tags={tags} jaTem={c.tags.map((t) => t.id)} onAplicar={(tagId) => aplicarTagNoContato(c.id, tagId)} />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-content">+{c.telefone}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-content">{c.totalMissoes}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted">{tempoRelativo(c.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modal === 'novo' && <NovoContatoModal onFechar={(criou) => { setModal(null); if (criou) carregar() }} />}
      {modal === 'whatsapp' && <ImportarWhatsAppModal onFechar={(imp) => { setModal(null); if (imp) carregar() }} />}
      {modal === 'tags' && <TagsModal tags={tags} onFechar={(mudou) => { setModal(null); if (mudou) carregar() }} />}
    </div>
  )
}
