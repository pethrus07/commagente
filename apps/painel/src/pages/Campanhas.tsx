import { useEffect, useState } from 'react'
import { BarChart3, Dna, Download, FileText, Megaphone, Plus, Send, Sparkles, UserPlus, X } from 'lucide-react'
import { EditorDnaCamada } from '../components/EditorDnaCamada'
import { SeletorContatos } from '../components/SeletorContatos'
import { SeletorMidia } from '../components/SeletorMidia'
import { api } from '../lib/api'
import { limparCamadaDna, type CamadaDna } from '../lib/dna'
import { TIPO_INFO, TIPOS_MISSAO, descreverDisparo, rotuloNumero } from '../lib/estados'
import { toast } from '../lib/toast'
import type { CampanhaResumo, Numero, RelatorioCampanha } from '../lib/types'
import { Button, Card, EmptyState, Spinner, cn, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

function NovaCampanhaModal({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [form, setForm] = useState({ nome: '', numeroId: '', tipo: 'vender', modo: 'auto', objetivo: '', criterioConclusao: '', tom: '', informacoes: '' })
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

  const criar = async () => {
    if (!form.nome.trim()) return toast('Dê um nome à campanha.', 'erro')
    if (!form.numeroId) return toast('Escolha um número.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo.', 'erro')
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
        midiaIds: midiaIds.length ? midiaIds : undefined, // herdada por cada missão da campanha
        dna: limparCamadaDna(dna), // camada de DNA da campanha (só categorias com texto)
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-content">Nova campanha</h3>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Nome da campanha</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Cobrança julho · Prospecção fornecedores" className={campo} />
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
            <label className="mb-1 block text-xs text-muted">Modo</label>
            <div className="flex gap-1.5">
              {(['auto', 'copilot'] as const).map((md) => (
                <button key={md} onClick={() => setForm({ ...form, modo: md })} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition', form.modo === md ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'text-muted ring-line hover:text-content')}>
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
          <div>
            <label className="mb-1 block text-xs text-muted">Objetivo</label>
            <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="O que a IA deve fazer em cada conversa" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Critério de conclusão (opcional)</label>
            <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} placeholder="Ex.: pagamento confirmado" className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Informações autorizadas (opcional)</label>
            <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={2} placeholder="Preços/prazos REAIS que a IA pode afirmar" className={cn(campo, 'resize-none')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">📎 Mídias da campanha (opcional)</label>
            <SeletorMidia valor={midiaIds} onChange={setMidiaIds} dica="Nada marcado → a IA pode enviar qualquer item da biblioteca em cada conversa." />
          </div>
          <EditorDnaCamada valor={dna} onChange={setDna} nivel="campanha" heranca="empresa" />
          <div className="border-t border-line pt-3">
            <SeletorContatos onChange={setContatos} onAlvoTag={setTagAlvo} />
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface2 p-3 text-sm">
            <input type="checkbox" checked={dispararAgora} onChange={(e) => setDispararAgora(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
            <span>
              <span className="font-medium text-content">Disparar agora</span>
              <span className="block text-xs text-muted">A IA já abre as conversas (no ritmo anti-bloqueio). Desmarque para só montar a campanha e disparar depois.</span>
            </span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onFechar(false)}>Cancelar</Button>
          <Button onClick={criar} loading={salvando}>{dispararAgora ? `Criar e disparar${tagAlvo ? ' (toda a tag)' : contatos.length ? ` (${contatos.length})` : ''}` : 'Criar campanha'}</Button>
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

// #9 Fase B — ajusta a camada de DNA de uma campanha JÁ criada (reflete vivo nas missões dela).
function EditarDnaModal({ campanha, onFechar }: { campanha: CampanhaResumo; onFechar: () => void }) {
  const [dna, setDna] = useState<CamadaDna>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.campanhas
      .obter(campanha.id)
      .then((c) => setDna((c.dna as CamadaDna) ?? {}))
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(() => setCarregando(false))
  }, [campanha.id])

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.campanhas.editarDna(campanha.id, limparCamadaDna(dna) ?? {})
      toast('DNA da campanha atualizado — vale já na próxima resposta.', 'ok')
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
            <h3 className="font-semibold text-content">DNA da campanha</h3>
            <p className="text-xs text-muted">{campanha.nome}</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        {carregando ? (
          <div className="grid place-items-center py-10"><Spinner className="h-6 w-6" /></div>
        ) : (
          <>
            <EditorDnaCamada valor={dna} onChange={setDna} nivel="campanha" heranca="empresa" />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
              <Button onClick={salvar} loading={salvando}>Salvar DNA</Button>
            </div>
          </>
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
                    <p className="truncate font-medium text-content">{c.nome}</p>
                    <p className="truncate text-xs text-muted">{TIPO_INFO[c.tipo]?.emoji} {TIPO_INFO[c.tipo]?.label} · {tempoRelativo(c.criadoEm)}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-content">{c.objetivo}</p>
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
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setRelatorio(c)}><FileText className="h-4 w-4" /> Relatório</Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setAdd(c)}><UserPlus className="h-4 w-4" /> Contatos</Button>
                  <Button variant="ghost" onClick={() => setDnaCamp(c)} title="DNA desta campanha"><Dna className="h-4 w-4" /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modal && <NovaCampanhaModal onFechar={(criou) => { setModal(false); if (criou) carregar() }} />}
      {add && <AddContatosModal campanha={add} onFechar={(a) => { setAdd(null); if (a) carregar() }} />}
      {dnaCamp && <EditarDnaModal campanha={dnaCamp} onFechar={() => setDnaCamp(null)} />}
      {relatorio && <RelatorioModal campanha={relatorio} onFechar={() => setRelatorio(null)} />}
    </div>
  )
}
