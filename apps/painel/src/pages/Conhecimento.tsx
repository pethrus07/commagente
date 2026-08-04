import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Bot, Check, Dna as DnaIcon, FileUp, Pencil, Plus, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import { EstiloControles } from '../components/EstiloControles'
import { api } from '../lib/api'
import { CATEGORIAS_DNA, type Dna } from '../lib/dna'
import { ESTILO_PADRAO } from '../lib/estilos-conversa'
import { toast } from '../lib/toast'
import type { Conhecimento as Item, EstiloConversa } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

// lê um arquivo e devolve só o base64 (sem o prefixo data:...;base64,)
const lerBase64 = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Falha ao ler o arquivo'))
    r.readAsDataURL(file)
  })

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

// sugestões rápidas que o usuário injeta na identidade (ideia: "fale informal" e a IA segue)
const CHIPS_PERSONA = [
  'Trate o cliente por "você".',
  'Seja direto e objetivo.',
  'Nunca seja insistente ou agressivo.',
  'Sempre termine com uma pergunta.',
]

// Card "DNA da empresa" (nível TENANT): o conhecimento categorizado que a IA usa e pode afirmar.
// Defaults-first: preencha só o que importa (categoria vazia não entra no prompt). Regras de
// Negócio têm prioridade máxima. Conteúdo longo (catálogo inteiro) vai pra Base de conhecimento.
function DnaCategorias() {
  const [dna, setDna] = useState<Dna>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.tenant
      .obter()
      .then((c) => setDna(c.dna ?? {}))
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  }, [])

  const preenchidas = CATEGORIAS_DNA.filter((c) => dna[c.chave]?.trim()).length

  const salvar = async () => {
    setSalvando(true)
    try {
      // manda todas as chaves (vazias limpam) — o backend mescla e descarta as vazias
      const payload = Object.fromEntries(
        CATEGORIAS_DNA.map((c) => [c.chave, dna[c.chave]?.trim() || '']),
      ) as Dna
      const atualizado = await api.tenant.salvarDna(payload)
      setDna(atualizado.dna ?? {})
      toast('DNA salvo — vale já no próximo turno da IA.', 'ok')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400"><DnaIcon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-content">DNA da empresa <span className="text-[11px] font-normal text-subtle">({preenchidas}/{CATEGORIAS_DNA.length} preenchidas)</span></h3>
          <p className="text-[11px] text-muted">O que a IA sabe e pode afirmar sobre o seu negócio. Preencha só o que importa — o resto é opcional.</p>
        </div>
      </div>

      {carregando ? (
        <div className="grid place-items-center py-6"><Spinner className="h-5 w-5" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CATEGORIAS_DNA.map((c) => (
              <div key={c.chave} className={cn('rounded-xl border p-3', c.prioridade ? 'border-amber-500/40 bg-amber-500/[0.05] md:col-span-2' : 'border-line')}>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-content">
                  {c.prioridade && <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                  {c.titulo}
                  {c.prioridade && <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">prioridade</span>}
                </label>
                <textarea
                  value={dna[c.chave] ?? ''}
                  onChange={(e) => setDna((d) => ({ ...d, [c.chave]: e.target.value }))}
                  rows={c.prioridade ? 3 : 2}
                  placeholder={c.dica}
                  className={cn(campo, 'resize-none text-[13px]')}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-subtle">A IA usa isto como <b>fonte autorizada</b> (pode afirmar). As <b>Regras de negócio</b> vencem tudo — nem a persona as contorna.</p>
            <Button onClick={salvar} loading={salvando}>Salvar DNA</Button>
          </div>
        </>
      )}
    </Card>
  )
}

// Card "Identidade & Estilo da IA" (nível TENANT): a voz da marca (persona) + o estilo PADRÃO
// da casa. É o FALLBACK — cada missão pode ter o seu perfil próprio (Assistente de missão);
// quando a missão não define, herda este. Reflete no próximo turno.
function ConfigIA() {
  const [persona, setPersona] = useState('')
  const [estilo, setEstilo] = useState<EstiloConversa>(ESTILO_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.tenant
      .obter()
      .then((c) => {
        setPersona(c.persona ?? '')
        setEstilo(c.estilo ?? ESTILO_PADRAO)
      })
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  }, [])

  const inserir = (frag: string) => setPersona((t) => (t.trim() ? `${t.trim()} ${frag}` : frag))

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.tenant.salvar({ persona: persona.trim() || null, estilo })
      toast('Identidade e estilo salvos — valem já no próximo turno.', 'ok')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300"><Bot className="h-4 w-4" /></div>
        <div>
          <h3 className="text-sm font-semibold text-content">Voz &amp; estilo da IA <span className="text-[11px] font-normal text-subtle">(padrão da casa)</span></h3>
          <p className="text-[11px] text-muted">Como a IA <b>fala</b> em todas as missões (o DNA acima é o que ela <b>sabe</b>). Cada missão pode ter o seu perfil — quando não tem, herda este.</p>
        </div>
      </div>

      {carregando ? (
        <div className="grid place-items-center py-6"><Spinner className="h-5 w-5" /></div>
      ) : (
        <>
          {/* Controles do estilo padrão (reusa o mesmo componente do builder de missão) */}
          <EstiloControles estilo={estilo} onChange={setEstilo} />

          {/* Persona (voz da marca) */}
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted">Voz da marca (persona)</label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={3}
              placeholder={'Ex.: Você é o atendente da [Empresa]. Trate por "você", seja simpático e direto. Nunca pressione o cliente.'}
              className={cn(campo, 'resize-none')}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHIPS_PERSONA.map((c) => (
                <button key={c} type="button" onClick={() => inserir(c)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-indigo-500/40 hover:text-content">+ {c}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-subtle">O estilo governa o <b>jeito de escrever</b>; a regra anti-invenção de preço continua valendo por cima.</p>
            <Button onClick={salvar} loading={salvando}>Salvar</Button>
          </div>
        </>
      )}
    </Card>
  )
}

export function Conhecimento() {
  const [itens, setItens] = useState<Item[] | null>(null)
  const [modal, setModal] = useState<{ inicial?: Item } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  const carregar = () =>
    api.conhecimento.listar().then(setItens).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo arquivo
    if (!file) return
    setImportando(true)
    try {
      const base64 = await lerBase64(file)
      const ent = await api.conhecimento.importarDocumento({
        nomeArquivo: file.name,
        mimetype: file.type || 'application/octet-stream',
        base64,
      })
      toast(`Documento "${ent.titulo}" adicionado ao conhecimento.`, 'ok')
      carregar()
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setImportando(false)
    }
  }

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
      {/* 🧬 DNA da IA — o que ela SABE (categorias) + como ela FALA (voz & estilo) */}
      <DnaCategorias />
      <ConfigIA />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Base de conhecimento: o que a IA aprende com as conversas e com os seus documentos (consultada por relevância). Para catálogos longos, use aqui — o DNA é o resumo essencial.</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => fileRef.current?.click()} loading={importando}><FileUp className="h-4 w-4" /> Importar documento</Button>
          <Button onClick={() => setModal({})}><Plus className="h-4 w-4" /> Novo</Button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onArquivo} className="hidden" />
        </div>
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
                    {i.origem === 'ia' ? '🤖 aprendido pela IA' : i.origem === 'documento' ? '📄 de documento' : '✍️ curado'} · {tempoRelativo(i.criadoEm)}
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
