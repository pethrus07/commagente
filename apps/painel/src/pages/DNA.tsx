/**
 * O DNA do tenant: o que a IA sabe e pode afirmar sobre a empresa, organizado em categorias
 * (empresa, produtos, preços, regras de negócio, FAQ…). Aceita texto, documento (PDF/DOCX/TXT)
 * e link. Defaults-first: categoria vazia não vira formulário obrigatório nem entra no prompt.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Dna as DnaIcon, FileText, FileUp, Link as LinkIcon, Plus, ShieldAlert, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { CATEGORIAS_DNA, type CategoriaDna, type Dna as DnaTipo } from '../lib/dna'
import { toast } from '../lib/toast'
import type { Conhecimento as Item } from '../lib/types'
import { Button, Card, Spinner, cn } from '../lib/ui'

const campo = 'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'
const lerBase64 = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Falha ao ler o arquivo'))
    r.readAsDataURL(file)
  })
const PESO: Record<string, number> = { empresa: 18, produtos: 16, precos: 16, regrasNegocio: 12, publicoAlvo: 10, diferenciais: 8, processoComercial: 8, faq: 6, casosSucesso: 4, glossario: 2 }

// Leitor limpo de documento (read-only, prosa) — não a textarea crua de antes.
function LeitorDoc({ item, onFechar }: { item: Item; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
      <Card className="flex max-h-[80vh] w-full flex-col p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="flex items-center gap-2 truncate font-semibold text-content"><FileText className="h-4 w-4 shrink-0 text-emerald-400" /> {item.titulo}</h3>
          <button onClick={onFechar} className="text-subtle hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.conteudo}</p>
        </div>
        <div className="border-t border-line px-5 py-2.5 text-[11px] text-subtle">
          {item.origem === 'documento' ? '📄 de documento' : item.origem === 'link' ? '🔗 de um site' : item.origem === 'ia' ? '🤖 aprendido pela IA' : '✍️ escrito à mão'} · a IA consulta este conteúdo por relevância.
        </div>
      </Card>
      </div>
    </div>
  )
}

// Editor focado de UMA categoria: o resumo (texto) + os documentos daquela categoria.
function EditorCategoria({
  cat, valor, docs, onFechar, onSalvar, onAnexar, onLink, onLer, onRemoverDoc, salvando,
}: {
  cat: CategoriaDna; valor: string; docs: Item[]
  onFechar: () => void; onSalvar: (texto: string) => void; onAnexar: () => void; onLink: (url: string) => Promise<void>; onLer: (i: Item) => void; onRemoverDoc: (id: string) => void; salvando: boolean
}) {
  const [texto, setTexto] = useState(valor)
  const [link, setLink] = useState('')
  const [mostrarLink, setMostrarLink] = useState(false)
  const [impLink, setImpLink] = useState(false)
  const importarLink = async () => {
    if (!link.trim()) return
    setImpLink(true)
    try { await onLink(link.trim()); setLink(''); setMostrarLink(false) } finally { setImpLink(false) }
  }
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-content">
            {cat.prioridade && <ShieldAlert className="h-4 w-4 text-amber-500" />}{cat.titulo}
            {cat.prioridade && <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">prioridade</span>}
          </h3>
          <button onClick={onFechar} className="text-subtle hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-[11px] text-muted">{cat.dica}</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={cat.prioridade ? 4 : 3} placeholder="Escreva um resumo…" className={cn(campo, 'resize-none text-[13px]')} />
        {/* documentos desta categoria */}
        <div className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <button onClick={() => onLer(d)} className="min-w-0 flex-1 truncate text-left text-[13px] text-content hover:text-indigo-300">{d.titulo}</button>
              <button onClick={() => onRemoverDoc(d.id)} className="text-subtle hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={onAnexar} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[12px] text-subtle transition hover:border-emerald-500/40 hover:text-content"><FileUp className="h-3.5 w-3.5" /> anexar documento</button>
            <button onClick={() => setMostrarLink((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[12px] text-subtle transition hover:border-emerald-500/40 hover:text-content"><LinkIcon className="h-3.5 w-3.5" /> colar link</button>
          </div>
          {mostrarLink && (
            <div className="flex gap-1.5">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://seusite.com/produtos" className={cn(campo, 'text-[13px]')} onKeyDown={(e) => e.key === 'Enter' && importarLink()} />
              <Button onClick={importarLink} loading={impLink}>Ler</Button>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => onSalvar(texto)} loading={salvando}>Salvar</Button>
        </div>
      </Card>
    </div>
  )
}

// "Outros conhecimentos": bucket LIVRE (categoria = null) pro que não cabe nas 10 categorias.
// Uma lista de entradas (escritas / documento / link) — a IA usa tudo por relevância (RAG).
function EditorGeral({ itens, onFechar, onMudou, onLer }: {
  itens: Item[]; onFechar: () => void; onMudou: () => void; onLer: (i: Item) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<'nota' | 'link' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const salvarNota = async () => {
    if (!conteudo.trim()) return toast('Escreva o conhecimento.', 'erro')
    setBusy('nota')
    try {
      await api.conhecimento.criar({ titulo: titulo.trim() || 'Conhecimento', conteudo: conteudo.trim(), categoria: null })
      toast('Conhecimento adicionado.', 'ok'); setTitulo(''); setConteudo(''); onMudou()
    } catch (e) { toast((e as Error).message, 'erro') } finally { setBusy(null) }
  }
  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const base64 = await lerBase64(file)
      await api.conhecimento.importarDocumento({ nomeArquivo: file.name, mimetype: file.type || 'application/octet-stream', base64, categoria: null })
      toast('Documento adicionado.', 'ok'); onMudou()
    } catch (err) { toast((err as Error).message, 'erro') }
  }
  const importarLink = async () => {
    if (!link.trim()) return
    setBusy('link')
    try { await api.conhecimento.importarUrl({ url: link.trim(), categoria: null }); toast('Site lido e adicionado.', 'ok'); setLink(''); onMudou() }
    catch (e) { toast((e as Error).message, 'erro') } finally { setBusy(null) }
  }
  const remover = async (id: string) => { try { await api.conhecimento.excluir(id); onMudou() } catch (e) { toast((e as Error).message, 'erro') } }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onArquivo} className="hidden" />
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-content"><Sparkles className="h-4 w-4 text-indigo-300" /> Outros conhecimentos</h3>
          <button onClick={onFechar} className="text-subtle hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-[11px] leading-snug text-muted">Qualquer coisa que a IA deva saber e não cabe nas categorias — política de troca, horário de funcionamento, regras específicas, avisos. Vira <b className="text-muted">fonte autorizada</b> (a IA consulta por relevância).</p>

        <div className="space-y-1.5">
          {itens.length === 0 && <p className="text-xs text-subtle">Nada aqui ainda.</p>}
          {itens.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2.5 py-1.5">
              {d.origem === 'link' ? <LinkIcon className="h-3.5 w-3.5 shrink-0 text-sky-400" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              <button onClick={() => onLer(d)} className="min-w-0 flex-1 truncate text-left text-[13px] text-content hover:text-indigo-300">{d.titulo}</button>
              <button onClick={() => remover(d.id)} className="text-subtle hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className={cn(campo, 'text-[13px]')} />
          <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={3} placeholder="Escreva o conhecimento…" className={cn(campo, 'resize-none text-[13px]')} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button onClick={salvarNota} loading={busy === 'nota'}><Plus className="h-4 w-4" /> Adicionar</Button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[12px] text-subtle transition hover:border-emerald-500/40 hover:text-content"><FileUp className="h-3.5 w-3.5" /> anexar documento</button>
          </div>
          <div className="flex gap-1.5">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://seusite.com/… (colar link)" className={cn(campo, 'text-[13px]')} onKeyDown={(e) => e.key === 'Enter' && importarLink()} />
            <Button variant="ghost" onClick={importarLink} loading={busy === 'link'}>Ler</Button>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onFechar}>Fechar</Button>
        </div>
      </Card>
    </div>
  )
}

// Página DNA: só o que a IA SABE. Lista clicável de categorias (defaults-first) → editor focado.
export function DNA() {
  const [dna, setDna] = useState<DnaTipo>({})
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState<CategoriaDna | null>(null)
  const [geralAberto, setGeralAberto] = useState(false)
  const [lendo, setLendo] = useState<Item | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = () =>
    Promise.all([api.tenant.obter(), api.conhecimento.listar()])
      .then(([c, l]) => { setDna(c.dna ?? {}); setItens(l) })
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  useEffect(() => { carregar() }, [])

  const docsDe = (chave: string) => itens.filter((i) => i.status === 'aprovado' && i.categoria === chave)
  const cheia = (c: CategoriaDna) => !!dna[c.chave]?.trim() || docsDe(c.chave).length > 0
  const score = CATEGORIAS_DNA.reduce((s, c) => s + (cheia(c) ? PESO[c.chave] ?? 0 : 0), 0)
  const corScore = score >= 75 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500'
  const sugeridos = itens.filter((i) => i.status === 'sugerido')
  const gerais = itens.filter((i) => i.status === 'aprovado' && !i.categoria) // conhecimento livre (sem categoria)

  const salvarCategoria = async (texto: string) => {
    if (!aberta) return
    setSalvando(true)
    try {
      await api.tenant.salvarDna({ [aberta.chave]: texto.trim() } as DnaTipo)
      setDna((d) => ({ ...d, [aberta.chave]: texto.trim() }))
      toast('Salvo — vale já no próximo turno da IA.', 'ok')
      setAberta(null)
    } catch (e) { toast((e as Error).message, 'erro') } finally { setSalvando(false) }
  }
  const anexar = () => fileRef.current?.click()
  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !aberta) return
    try {
      const base64 = await lerBase64(file)
      await api.conhecimento.importarDocumento({ nomeArquivo: file.name, mimetype: file.type || 'application/octet-stream', base64, categoria: aberta.chave })
      toast('Documento anexado.', 'ok'); carregar()
    } catch (err) { toast((err as Error).message, 'erro') }
  }
  const removerDoc = async (id: string) => { try { await api.conhecimento.excluir(id); carregar() } catch (e) { toast((e as Error).message, 'erro') } }
  const importarLink = async (url: string) => {
    if (!aberta) return
    try { await api.conhecimento.importarUrl({ url, categoria: aberta.chave }); toast('Site lido e adicionado ao DNA.', 'ok'); carregar() }
    catch (e) { toast((e as Error).message, 'erro') }
  }
  const curar = async (id: string, s: 'aprovado' | 'rejeitado') => { try { await api.conhecimento.status(id, s); carregar() } catch (e) { toast((e as Error).message, 'erro') } }

  if (carregando) return <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onArquivo} className="hidden" />

      {/* Força do DNA — barra fina + o que falta */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-content"><DnaIcon className="h-4 w-4 text-emerald-400" /> Força do DNA</span>
          <span className="font-mono text-xs text-muted">{score}/100</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className={cn('h-full rounded-full transition-all', corScore)} style={{ width: score + '%' }} /></div>
        <p className="mt-2 text-[11px] text-subtle">Clique numa categoria pra preencher. A IA usa isto como <b className="text-muted">fonte autorizada</b> — só afirma o que estiver aqui.</p>
      </Card>

      {/* Lista de categorias (clicável) */}
      <div className="overflow-hidden rounded-2xl border border-line">
        {CATEGORIAS_DNA.map((c, i) => {
          const docs = docsDe(c.chave)
          const temTexto = !!dna[c.chave]?.trim()
          const preenchida = temTexto || docs.length > 0
          return (
            <button
              key={c.chave}
              onClick={() => setAberta(c)}
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface2', i > 0 && 'border-t border-line', c.prioridade && 'bg-amber-500/[0.04]')}
            >
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', preenchida ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface2 text-subtle')}>
                {preenchida ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-sm font-medium text-content">{c.titulo}</span>
                {c.prioridade && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              </span>
              <span className="shrink-0 text-[11px] text-subtle">
                {!preenchida ? 'vazio' : [temTexto && 'resumo', docs.length > 0 && `${docs.length} doc${docs.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
            </button>
          )
        })}
      </div>

      {/* Outros conhecimentos — bucket livre pro que não cabe nas categorias */}
      <button
        onClick={() => setGeralAberto(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left transition hover:border-indigo-500/40 hover:bg-surface2"
      >
        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', gerais.length > 0 ? 'bg-indigo-500/15 text-indigo-300' : 'bg-surface2 text-subtle')}>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-content">Outros conhecimentos</span>
          <span className="text-[11px] text-subtle">qualquer coisa que não se encaixe nas categorias acima</span>
        </span>
        <span className="shrink-0 text-[11px] text-subtle">{gerais.length > 0 ? `${gerais.length} item${gerais.length > 1 ? 's' : ''}` : 'vazio'}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
      </button>

      {/* Sugestões da IA (curadoria rápida) */}
      {sugeridos.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-content"><Sparkles className="h-4 w-4 text-violet-400" /> Sugerido pela IA <span className="rounded-full bg-violet-500/20 px-2 text-[11px] font-medium text-violet-700 dark:text-violet-300">{sugeridos.length}</span></h3>
          {sugeridos.map((s) => (
            <Card key={s.id} className="border-violet-500/25 bg-violet-500/[0.06] p-3">
              <p className="text-[13px] text-content">{s.conteudo}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={() => curar(s.id, 'aprovado')}><Check className="h-4 w-4" /> Aprovar</Button>
                <Button variant="ghost" onClick={() => curar(s.id, 'rejeitado')}><X className="h-4 w-4" /> Descartar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {aberta && (
        <EditorCategoria
          cat={aberta} valor={dna[aberta.chave] ?? ''} docs={docsDe(aberta.chave)}
          onFechar={() => setAberta(null)} onSalvar={salvarCategoria} onAnexar={anexar} onLink={importarLink} onLer={setLendo} onRemoverDoc={removerDoc} salvando={salvando}
        />
      )}
      {geralAberto && <EditorGeral itens={gerais} onFechar={() => setGeralAberto(false)} onMudou={carregar} onLer={setLendo} />}
      {lendo && <LeitorDoc item={lendo} onFechar={() => setLendo(null)} />}
    </div>
  )
}
