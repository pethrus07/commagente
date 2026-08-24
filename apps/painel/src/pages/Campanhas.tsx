import { useEffect, useState } from 'react'
import { BarChart3, Copy, Dna, Download, FileText, Megaphone, Paperclip, Pause, Pencil, Play, Plus, Send, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditorDnaCamada } from '../components/EditorDnaCamada'
import { EstiloControles } from '../components/EstiloControles'
import { SeletorContatos } from '../components/SeletorContatos'
import { SeletorMidia } from '../components/SeletorMidia'
import { api } from '../lib/api'
import { limparCamadaDna, type CamadaDna } from '../lib/dna'
import { ESTILO_PADRAO } from '../lib/estilos-conversa'
import { MODELOS, type ModeloMissao } from '../lib/modelos-missao'
import { TIPO_INFO, TIPOS_MISSAO, descreverDisparo, rotuloNumero } from '../lib/estados'
import { toast } from '../lib/toast'
import type { CampanhaResumo, EstiloConversa, Numero, RelatorioCampanha } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

// Fluxo espelhado no assistente de missão: Modelo (ponto de partida) → Ajustar → Contatos.
const PASSOS_CAMPANHA = ['Modelo', 'Ajustar', 'Contatos'] as const

function NovaCampanhaModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [passo, setPasso] = useState(0)
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [form, setForm] = useState({ nome: '', numeroId: '', tipo: 'vender', modo: 'auto' as 'auto' | 'copilot', objetivo: '', criterioConclusao: '', tom: '', informacoes: '', informacoesDica: 'Preços/prazos REAIS que a IA pode afirmar.' })
  const [estilo, setEstilo] = useState<EstiloConversa>(ESTILO_PADRAO) // perfil de conversa da campanha (herdado por cada missão)
  const [contatos, setContatos] = useState<{ telefone: string; nome?: string }[]>([])
  const [tagAlvo, setTagAlvo] = useState<string | null>(null)
  const [midiaIds, setMidiaIds] = useState<string[]>([]) // biblioteca curada da campanha (§9 Fase A)
  const [dna, setDna] = useState<CamadaDna>({}) // camada de DNA da campanha (§9 Fase B)
  const [dispararAgora, setDispararAgora] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const c = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (c) setForm((f) => ({ ...f, numeroId: c.id }))
    })
  }, [])

  // escolher um modelo pré-preenche os campos (tipo/objetivo/tom/critério/perfil) e vai pro Ajustar
  const escolherModelo = (m: ModeloMissao) => {
    setModeloId(m.id)
    setEstilo(m.estilo)
    setForm((f) => ({ ...f, tipo: m.tipo, modo: m.modo, objetivo: m.objetivo, tom: m.tom, criterioConclusao: m.criterioConclusao, informacoesDica: m.informacoesDica }))
    setPasso(1)
  }

  const avancar = () => {
    if (!form.nome.trim()) return toast('Dê um nome à campanha.', 'erro')
    if (!form.numeroId) return toast('Escolha um número.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo.', 'erro')
    setPasso(2)
  }

  const criar = async () => {
    if (contatos.length === 0 && !tagAlvo) return toast('Escolha ao menos um contato ou uma tag.', 'erro')
    setSalvando(true)
    try {
      const { criadas, campanha } = await api.campanhas.criar({
        nome: form.nome.trim(),
        numeroId: form.numeroId,
        tipo: form.tipo,
        modo: form.modo,
        objetivo: form.objetivo.trim(),
        criterioConclusao: form.criterioConclusao.trim() || undefined,
        tom: form.tom.trim() || undefined,
        informacoes: form.informacoes.trim() || undefined,
        midiaIds: midiaIds.length ? midiaIds : undefined, // herdada AO VIVO por cada missão da campanha
        dna: limparCamadaDna(dna), // camada de DNA da campanha (só categorias com texto)
        estilo, // perfil de conversa da campanha (herdado por cada missão)
        ...(tagAlvo ? { tagId: tagAlvo } : { contatos }),
      })
      if (dispararAgora) {
        const r = await api.campanhas.iniciar(campanha.id)
        toast(`Campanha criada e disparada — ${descreverDisparo(r)}.`, 'ok')
      } else {
        toast(`Campanha criada — ${criadas} conversa${criadas === 1 ? '' : 's'} (aguardando disparo).`, 'ok')
      }
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const numeroSel = numeros.find((n) => n.id === form.numeroId)
  const alvoTxt = tagAlvo ? 'toda a tag' : contatos.length ? `${contatos.length} contato${contatos.length === 1 ? '' : 's'}` : 'nenhum ainda'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden p-0">
        {/* cabeçalho + stepper (mesmo padrão do assistente de missão) */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-indigo-300" />
            <h3 className="font-semibold text-content">Nova campanha</h3>
          </div>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2 px-6 py-3">
          {PASSOS_CAMPANHA.map((nome, i) => (
            <div key={nome} className="flex items-center gap-2">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition', i < passo ? 'bg-indigo-500 text-white' : i === passo ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/50' : 'bg-surface2 text-muted')}>
                {i + 1}
              </span>
              <span className={cn('text-xs font-medium', i === passo ? 'text-content' : 'text-muted')}>{nome}</span>
              {i < PASSOS_CAMPANHA.length - 1 && <span className="mx-1 h-px w-6 bg-surface2" />}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4">
          {/* PASSO 1 — Modelo (ponto de partida) */}
          {passo === 0 && (
            <div>
              <p className="mb-3 text-sm text-muted">O que essa campanha vai fazer? Escolha um ponto de partida — dá pra ajustar tudo depois.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODELOS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => escolherModelo(m)}
                    className={cn('flex flex-col rounded-xl border p-3 text-left transition', modeloId === m.id ? 'border-indigo-500/50 bg-indigo-500/[0.08]' : 'border-line bg-surface2 hover:border-line-strong')}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="mt-1 text-sm font-medium text-content">{m.titulo}</span>
                    <span className="mt-0.5 text-xs leading-snug text-muted">{m.resumo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 2 — Ajustar (nome + config + mídia + DNA + perfil) */}
          {passo === 1 && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="mb-1 block text-xs text-muted">Nome da campanha</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Cobrança julho · Prospecção fornecedores" className={campo} autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Objetivo — o que a IA deve fazer em cada conversa</label>
                <textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} placeholder="Ex.: Apresentar a solução e agendar uma conversa" className={cn(campo, 'resize-none')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Tom / humor</label>
                <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} placeholder="Ex.: amigável e consultivo, sem pressão" className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Quando considerar concluída (opcional)</label>
                <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} placeholder="Ex.: pagamento confirmado" className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Informações autorizadas</label>
                <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} placeholder={form.informacoesDica} className={cn(campo, 'resize-none')} />
                <p className="mt-1 text-[11px] leading-snug text-muted">🛡️ A IA só afirma o que estiver aqui. Fora disso, confirma ou escala.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">📎 Mídias da campanha (opcional)</label>
                <SeletorMidia valor={midiaIds} onChange={setMidiaIds} dica="Nada marcado → a IA pode enviar qualquer item da biblioteca. Cada missão da campanha herda isto ao vivo." />
              </div>
              <EditorDnaCamada valor={dna} onChange={setDna} nivel="campanha" heranca="empresa" />
              {/* Perfil de conversa — vem do modelo, ajustável */}
              <div className="rounded-xl border border-line bg-surface/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted">Perfil de conversa — como a IA escreve</label>
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">{estilo.perfil ?? 'Personalizado'}</span>
                </div>
                <EstiloControles estilo={estilo} onChange={setEstilo} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted">Modo</label>
                  <div className="flex gap-1.5">
                    {(['auto', 'copilot'] as const).map((md) => (
                      <button key={md} onClick={() => setForm({ ...form, modo: md })} className={cn('flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.modo === md ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
                        {md === 'auto' ? '⚡ Auto' : '👁️ Co-pilot'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Número (chip)</label>
                  <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
                    {numeros.length === 0 && <option value="">— nenhum número —</option>}
                    {numeros.map((n) => (<option key={n.id} value={n.id} className="bg-slate-900">{rotuloNumero(n)}{n.apelido ? ` · +${n.telefone}` : ''} ({n.statusConexao})</option>))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3 — Contatos + disparo + resumo */}
          {passo === 2 && (
            <div className="space-y-4 pt-1">
              <SeletorContatos onChange={setContatos} onAlvoTag={setTagAlvo} />
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface2 p-3 text-sm">
                <input type="checkbox" checked={dispararAgora} onChange={(e) => setDispararAgora(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
                <span>
                  <span className="font-medium text-content">Disparar agora</span>
                  <span className="block text-xs text-muted">A IA já abre as conversas (no ritmo anti-bloqueio). Desmarque para só montar a campanha e disparar depois.</span>
                </span>
              </label>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300/80"><Send className="h-3.5 w-3.5" /> Resumo</p>
                <ul className="space-y-1.5 text-sm text-content">
                  <li><span className="text-muted">Nome:</span> {form.nome || <span className="text-subtle">—</span>}</li>
                  <li><span className="text-muted">Objetivo:</span> {form.objetivo || <span className="text-subtle">—</span>}</li>
                  <li><span className="text-muted">Perfil:</span> {estilo.perfil ?? 'Personalizado'}</li>
                  <li><span className="text-muted">Envio por:</span> {numeroSel ? rotuloNumero(numeroSel) : '—'}</li>
                  {(midiaIds.length > 0 || Object.keys(dna).length > 0) && (
                    <li><span className="text-muted">Camadas:</span> {[midiaIds.length && `${midiaIds.length} mídia${midiaIds.length === 1 ? '' : 's'}`, Object.keys(dna).length && `DNA próprio (${Object.keys(dna).length})`].filter(Boolean).join(' · ')}</li>
                  )}
                  <li><span className="text-muted">Alvo:</span> {alvoTxt}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* rodapé — navegação */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={() => (passo === 0 ? onFechar(false) : setPasso(passo - 1))}>{passo === 0 ? 'Cancelar' : 'Voltar'}</Button>
          {passo === 0 ? (
            <span className="text-xs text-subtle">Escolha um modelo pra continuar</span>
          ) : passo === 1 ? (
            <Button onClick={avancar}>Avançar</Button>
          ) : (
            <Button onClick={criar} loading={salvando}>{dispararAgora ? `Criar e disparar${tagAlvo ? ' (toda a tag)' : contatos.length ? ` (${contatos.length})` : ''}` : 'Criar campanha'}</Button>
          )}
        </div>
      </Card>
    </div>
  )
}

function AddContatosModal({ campanha, onFechar }: { campanha: CampanhaResumo; onFechar: (add: boolean) => void }) {
  const [contatos, setContatos] = useState<{ telefone: string; nome?: string }[]>([])
  const [tagAlvo, setTagAlvo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const adicionar = async () => {
    if (contatos.length === 0 && !tagAlvo) return toast('Escolha ao menos um contato ou uma tag.', 'erro')
    setSalvando(true)
    try {
      const { criadas } = await api.campanhas.adicionarContatos(campanha.id, tagAlvo ? { tagId: tagAlvo } : { contatos })
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
          <h3 className="font-semibold text-content">Adicionar contatos</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-muted">à campanha <b className="text-content">{campanha.nome}</b> — cada um vira uma nova conversa com a mesma definição.</p>
        <SeletorContatos onChange={setContatos} onAlvoTag={setTagAlvo} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={adicionar} loading={salvando}><UserPlus className="h-4 w-4" /> Adicionar {tagAlvo ? '(toda a tag)' : contatos.length > 0 ? `(${contatos.length})` : ''}</Button>
        </div>
      </Card>
    </div>
  )
}

const rotularEstado = (e: string) => e.replace(/_/g, ' ')
const valorFato = (v: unknown) =>
  v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)

function RelatorioModal({ campanha, onFechar }: { campanha: CampanhaResumo; onFechar: () => void }) {
  const [rel, setRel] = useState<RelatorioCampanha | null>(null)
  const [sintese, setSintese] = useState<string | null>(null)
  const [sintetizando, setSintetizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.campanhas
      .relatorio(campanha.id)
      .then(setRel)
      .catch((e) => setErro((e as Error).message))
  }, [campanha.id])

  const consolidar = async () => {
    setSintetizando(true)
    try {
      const { sintese } = await api.campanhas.sintetizar(campanha.id)
      setSintese(sintese)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSintetizando(false)
    }
  }

  const exportar = async () => {
    try {
      const csv = await api.campanhas.exportarCsv(campanha.id)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${campanha.nome.replace(/[^\w.-]+/g, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  const taxa = rel && rel.total > 0 ? Math.round((rel.concluidas / rel.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold text-content">
              <FileText className="h-5 w-5 text-indigo-300" /> Relatório · {campanha.nome}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted">{campanha.objetivo}</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {erro ? (
            <p className="text-sm text-rose-300">{erro}</p>
          ) : !rel ? (
            <div className="grid place-items-center py-16"><Spinner className="h-6 w-6" /></div>
          ) : (
            <div className="space-y-5">
              {/* placar */}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-surface2 px-3 py-1.5 text-content"><b className="tabular-nums">{rel.total}</b> <span className="text-muted">conversas</span></span>
                <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-300"><b className="tabular-nums">{rel.concluidas}</b> cumpridas</span>
                {rel.escaladas > 0 && <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-amber-300"><b className="tabular-nums">{rel.escaladas}</b> escaladas</span>}
                <span className="rounded-lg bg-surface2 px-3 py-1.5 text-muted tabular-nums">{taxa}% conclusão</span>
              </div>

              {/* ações */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={consolidar} loading={sintetizando}><Sparkles className="h-4 w-4" /> Consolidar com IA</Button>
                <Button variant="ghost" onClick={exportar}><Download className="h-4 w-4" /> Exportar CSV</Button>
              </div>

              {/* síntese da IA */}
              {sintese && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-indigo-300"><Sparkles className="h-3.5 w-3.5" /> Relatório consolidado</p>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-content">{sintese}</div>
                </div>
              )}

              {/* tabela de coleta */}
              {rel.linhas.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-6 w-6" />} titulo="Sem conversas ainda" texto="Dispare a campanha — o relatório se preenche conforme as conversas rolam." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface2 text-xs text-muted">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Contato</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Estado</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Desfecho</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Resumo</th>
                        {rel.camposFatos.map((k) => (
                          <th key={k} className="whitespace-nowrap px-3 py-2 font-medium">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rel.linhas.map((l) => (
                        <tr key={l.missaoId} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-content">{l.contato}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted">{rotularEstado(l.estado)}</td>
                          <td className="px-3 py-2 text-content">{l.resultado ?? '—'}</td>
                          <td className="max-w-xs px-3 py-2 text-muted">{l.resumo ?? '—'}</td>
                          {rel.camposFatos.map((k) => (
                            <td key={k} className="px-3 py-2 text-content">{valorFato(l.fatos[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// #9 — edita a campanha JÁ criada, COMPLETA (config + perfil + mídia + DNA), igual à missão.
function EditarCampanhaModal({ campanha, onFechar }: { campanha: CampanhaResumo; onFechar: () => void }) {
  const [form, setForm] = useState({ nome: '', tipo: 'vender', modo: 'auto' as 'auto' | 'copilot', objetivo: '', criterioConclusao: '', tom: '', informacoes: '' })
  const [estilo, setEstilo] = useState<EstiloConversa>(ESTILO_PADRAO)
  const [dna, setDna] = useState<CamadaDna>({})
  const [midiaIds, setMidiaIds] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.campanhas
      .obter(campanha.id)
      .then((c) => {
        setForm({ nome: c.nome, tipo: c.tipo, modo: (c.modo as 'auto' | 'copilot') ?? 'auto', objetivo: c.objetivo, criterioConclusao: c.criterioConclusao ?? '', tom: c.tom ?? '', informacoes: c.informacoes ?? '' })
        setEstilo(c.estilo ?? ESTILO_PADRAO)
        setDna((c.dna as CamadaDna) ?? {})
        setMidiaIds(c.midiaIds ?? [])
      })
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  }, [campanha.id])

  const salvar = async () => {
    if (!form.nome.trim()) return toast('Dê um nome à campanha.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo.', 'erro')
    setSalvando(true)
    try {
      await api.campanhas.editar(campanha.id, {
        nome: form.nome.trim(),
        tipo: form.tipo,
        modo: form.modo,
        objetivo: form.objetivo.trim(),
        criterioConclusao: form.criterioConclusao.trim() || null,
        tom: form.tom.trim() || null,
        informacoes: form.informacoes.trim() || null,
        estilo,
        dna: limparCamadaDna(dna) ?? {},
        midiaIds,
      })
      toast('Campanha atualizada.', 'ok')
      onFechar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-content">Editar campanha</h3>
            <p className="text-xs text-muted">Muda a definição da campanha (vale pras próximas missões; DNA e mídia refletem ao vivo nas atuais).</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        {carregando ? (
          <div className="grid place-items-center py-10"><Spinner className="h-6 w-6" /></div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Nome da campanha</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
            </div>
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
              <label className="mb-1 block text-xs text-muted">Tom / humor</label>
              <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Critério de conclusão (opcional)</label>
              <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Informações autorizadas (opcional)</label>
              <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} className={cn(campo, 'resize-none')} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Modo</label>
                <div className="flex gap-1.5">
                  {(['auto', 'copilot'] as const).map((md) => (
                    <button key={md} onClick={() => setForm({ ...form, modo: md })} className={cn('flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.modo === md ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
                      {md === 'auto' ? '⚡ Auto' : '👁️ Co-pilot'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">📎 Mídias da campanha</label>
              <SeletorMidia valor={midiaIds} onChange={setMidiaIds} dica="As missões desta campanha herdam isto ao vivo." />
            </div>
            <EditorDnaCamada valor={dna} onChange={setDna} nivel="campanha" heranca="empresa" />
            <div className="rounded-xl border border-line bg-surface/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">Perfil de conversa — como a IA escreve</label>
                <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">{estilo.perfil ?? 'Personalizado'}</span>
              </div>
              <EstiloControles estilo={estilo} onChange={setEstilo} />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
              <Button onClick={salvar} loading={salvando}>Salvar</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export function Campanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaResumo[] | null>(null)
  const [modal, setModal] = useState(false)
  const [add, setAdd] = useState<CampanhaResumo | null>(null)
  const [dnaCamp, setDnaCamp] = useState<CampanhaResumo | null>(null)
  const [relatorio, setRelatorio] = useState<CampanhaResumo | null>(null)
  const [excluir, setExcluir] = useState<CampanhaResumo | null>(null)

  const [disparando, setDisparando] = useState<string | null>(null)

  const carregar = () =>
    api.campanhas.listar().then(setCampanhas).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const disparar = async (c: CampanhaResumo) => {
    setDisparando(c.id)
    try {
      const r = await api.campanhas.iniciar(c.id)
      toast(`Disparo — ${descreverDisparo(r)}.`, 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setDisparando(null)
    }
  }

  // duplica a definição (sem contatos/missões) — base pra teste A/B
  const duplicar = async (c: CampanhaResumo) => {
    try {
      await api.campanhas.duplicar(c.id)
      toast('Campanha duplicada. Ajuste a variante (A/B) e adicione os contatos.', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  // pausa/retoma a campanha (a IA para/volta a enviar e responder — histórico preservado)
  const pausar = async (c: CampanhaResumo) => {
    try {
      await api.campanhas.pausar(c.id, !c.pausada)
      toast(c.pausada ? 'Campanha retomada — a IA volta de onde parou.' : 'Campanha pausada — a IA para de enviar/responder (o histórico fica salvo).', 'ok')
      carregar()
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Uma definição de missão disparada pra vários contatos — dá pra adicionar mais a qualquer momento.</p>
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
                    <p className="flex items-center gap-2 truncate font-medium text-content">
                      {c.nome}
                      {c.pausada && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">pausada</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{TIPO_INFO[c.tipo]?.emoji} {TIPO_INFO[c.tipo]?.label} · {tempoRelativo(c.criadoEm)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-content">{c.objetivo}</p>
                {/* camadas configuradas (#9): DNA próprio + mídias curadas */}
                {((c.dnaAjustes ?? 0) > 0 || (c.midias ?? 0) > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(c.dnaAjustes ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/12 px-2 py-0.5 text-[11px] text-indigo-200"><Dna className="h-3 w-3" /> DNA próprio ({c.dnaAjustes})</span>
                    )}
                    {(c.midias ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[11px] text-emerald-200"><Paperclip className="h-3 w-3" /> {c.midias} mídia{c.midias === 1 ? '' : 's'}</span>
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="text-content"><b className="tabular-nums">{c.total}</b> <span className="text-muted">conversas</span></span>
                  <span className="text-emerald-300"><b className="tabular-nums">{c.cumpridas}</b> <span className="text-emerald-300/60">cumpridas</span></span>
                  <span className="ml-auto text-xs text-muted tabular-nums">{taxa}%</span>
                </div>
                {c.pendentes > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    <span className="flex-1"><b className="tabular-nums">{c.pendentes}</b> aguardando disparo</span>
                    <Button onClick={() => disparar(c)} loading={disparando === c.id} className="!py-1 !text-xs"><Send className="h-3.5 w-3.5" /> Disparar</Button>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setRelatorio(c)}><FileText className="h-4 w-4" /> Relatório</Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setAdd(c)}><UserPlus className="h-4 w-4" /> Contatos</Button>
                  <Button variant="ghost" onClick={() => setDnaCamp(c)} title="Editar mídia e DNA da campanha"><Pencil className="h-4 w-4" /> Editar</Button>
                  <Button variant="ghost" onClick={() => pausar(c)} title={c.pausada ? 'Retomar — a IA volta a enviar/responder' : 'Pausar — a IA para de enviar/responder (histórico salvo)'}>{c.pausada ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
                  <Button variant="ghost" onClick={() => duplicar(c)} title="Duplicar (teste A/B)"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" onClick={() => setExcluir(c)} title="Excluir campanha" className="text-rose-400 hover:text-rose-300"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modal && <NovaCampanhaModal onFechar={(criou) => { setModal(false); if (criou) carregar() }} />}
      {add && <AddContatosModal campanha={add} onFechar={(a) => { setAdd(null); if (a) carregar() }} />}
      {dnaCamp && <EditarCampanhaModal campanha={dnaCamp} onFechar={() => setDnaCamp(null)} />}
      {relatorio && <RelatorioModal campanha={relatorio} onFechar={() => setRelatorio(null)} />}
      {excluir && (
        <ConfirmDialog
          titulo={`Excluir "${excluir.nome}"?`}
          mensagem={
            <>
              Isso apaga a campanha e as <b>{excluir.total}</b> missão(ões)/conversa(s) dela. <b>Não dá pra desfazer.</b>
            </>
          }
          confirmarLabel="Excluir campanha"
          onConfirmar={async () => {
            try {
              const r = await api.campanhas.excluir(excluir.id)
              toast(`Campanha excluída (${r.missoesExcluidas} missões).`, 'ok')
              setExcluir(null)
              carregar()
            } catch (e) {
              toast((e as Error).message, 'erro')
            }
          }}
          onFechar={() => setExcluir(null)}
        />
      )}
    </div>
  )
}
