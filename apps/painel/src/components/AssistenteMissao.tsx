import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Rocket, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { rotuloNumero } from '../lib/estados'
import { ESTILO_PADRAO } from '../lib/estilos-conversa'
import { MODELOS, type ModeloMissao } from '../lib/modelos-missao'
import { toast } from '../lib/toast'
import type { EstiloConversa, Numero } from '../lib/types'
import { Button, Card, cn } from '../lib/ui'
import { EstiloControles } from './EstiloControles'
import { SeletorContatos } from './SeletorContatos'
import { SeletorMidia } from './SeletorMidia'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

type Contato = { telefone: string; nome?: string }

const PASSOS = ['Modelo', 'Ajustar', 'Contatos'] as const

// Builder visual de missões (Tier 3): assistente em 3 passos, com modelos prontos,
// pra quem não é técnico montar uma missão sem encarar o formulário cru.
export function AssistenteMissao({ onFechar }: { onFechar: (criou: boolean) => void }) {
  const [passo, setPasso] = useState(0)
  const [numeros, setNumeros] = useState<Numero[]>([])
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [form, setForm] = useState({
    numeroId: '',
    tipo: 'vender',
    modo: 'auto' as 'auto' | 'copilot',
    objetivo: '',
    tom: '',
    criterioConclusao: '',
    informacoes: '',
    informacoesDica: 'Preços, prazos e condições REAIS que a IA pode afirmar.',
  })
  const [contatos, setContatos] = useState<Contato[]>([])
  const [midiaIds, setMidiaIds] = useState<string[]>([]) // biblioteca curada desta missão (§9 Fase A)
  const [estilo, setEstilo] = useState<EstiloConversa>(ESTILO_PADRAO) // perfil de conversa da missão
  const [reativo, setReativo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.numeros.listar().then((ns) => {
      setNumeros(ns)
      const conectado = ns.find((n) => n.statusConexao === 'conectado') ?? ns[0]
      if (conectado) setForm((f) => ({ ...f, numeroId: conectado.id }))
    })
  }, [])

  const escolherModelo = (m: ModeloMissao) => {
    setModeloId(m.id)
    setReativo(m.tipo === 'suporte') // suporte já entra como reativo por padrão
    setEstilo(m.estilo) // o perfil de conversa vem embutido no modelo (ajustável no passo seguinte)
    setForm((f) => ({
      ...f,
      tipo: m.tipo,
      modo: m.modo,
      objetivo: m.objetivo,
      tom: m.tom,
      criterioConclusao: m.criterioConclusao,
      informacoesDica: m.informacoesDica,
    }))
    setPasso(1)
  }

  const ehSuporte = form.tipo === 'suporte'

  const criar = async () => {
    if (!form.numeroId) return toast('Cadastre/conecte um número primeiro.', 'erro')
    if (!form.objetivo.trim()) return toast('Descreva o objetivo da missão.', 'erro')
    // no reativo, contatos são opcionais (a IA atende quem entrar em contato)
    if (!(ehSuporte && reativo) && contatos.length === 0)
      return toast('Escolha ao menos um contato.', 'erro')
    setSalvando(true)
    try {
      // liga o suporte reativo no número (a IA atende inbound sem missão prévia)
      if (ehSuporte && reativo) {
        await api.numeros.editar(form.numeroId, {
          suporteReativo: true,
          suporteObjetivo: form.objetivo.trim(),
          suporteTom: form.tom.trim() || null,
          suporteInformacoes: form.informacoes.trim() || null,
          suporteCriterio: form.criterioConclusao.trim() || null,
          suporteModo: form.modo,
        })
      }
      // cria conversas proativas pros contatos escolhidos (se houver)
      let criadas = 0
      if (contatos.length > 0) {
        const r = await api.missoes.criarLote({
          numeroId: form.numeroId,
          tipo: form.tipo,
          modo: form.modo,
          objetivo: form.objetivo.trim(),
          criterioConclusao: form.criterioConclusao.trim() || undefined,
          tom: form.tom.trim() || undefined,
          informacoes: form.informacoes.trim() || undefined,
          midiaIds: midiaIds.length ? midiaIds : undefined, // mídias curadas (vazio → toda a biblioteca)
          estilo, // perfil de conversa desta missão (personalizado se ajustado)
          contatos,
        })
        criadas = r.criadas
      }
      if (ehSuporte && reativo)
        toast(
          criadas === 0
            ? 'Suporte reativo ativado — a IA vai atender quem entrar em contato. 🛟'
            : `Suporte reativo ativado + ${criadas} conversa${criadas === 1 ? '' : 's'} iniciada${criadas === 1 ? '' : 's'}. 🛟`,
          'ok',
        )
      else toast(criadas === 1 ? 'Missão criada.' : `${criadas} missões criadas (uma por contato).`, 'ok')
      onFechar(true)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const numeroSel = useMemo(() => numeros.find((n) => n.id === form.numeroId), [numeros, form.numeroId])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden p-0">
        {/* cabeçalho + stepper */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-300" />
            <h3 className="font-semibold text-content">Assistente de missão</h3>
          </div>
          <button onClick={() => onFechar(false)} className="text-muted hover:text-content"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2 px-6 py-3">
          {PASSOS.map((nome, i) => (
            <div key={nome} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition',
                  i < passo ? 'bg-indigo-500 text-white' : i === passo ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/50' : 'bg-surface2 text-muted',
                )}
              >
                {i < passo ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('text-xs font-medium', i === passo ? 'text-content' : 'text-muted')}>{nome}</span>
              {i < PASSOS.length - 1 && <span className="mx-1 h-px w-6 bg-surface2" />}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {/* PASSO 1 — modelo */}
          {passo === 0 && (
            <div>
              <p className="mb-3 text-sm text-muted">O que você quer que a IA faça? Escolha um ponto de partida — dá pra ajustar tudo depois.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODELOS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => escolherModelo(m)}
                    className={cn(
                      'flex flex-col rounded-xl border p-3 text-left transition',
                      modeloId === m.id ? 'border-indigo-500/50 bg-indigo-500/[0.08]' : 'border-line bg-surface2 hover:border-line-strong hover:bg-surface2',
                    )}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="mt-1 text-sm font-medium text-content">{m.titulo}</span>
                    <span className="mt-0.5 text-xs leading-snug text-muted">{m.resumo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 2 — ajustar */}
          {passo === 1 && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="mb-1 block text-xs text-muted">Objetivo — o que a IA deve alcançar</label>
                <textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={2} placeholder="Ex.: Apresentar a solução e agendar uma conversa" className={cn(campo, 'resize-none')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Tom / humor</label>
                <input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} placeholder="Ex.: amigável e consultivo, sem pressão" className={campo} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Quando considerar concluída</label>
                <input value={form.criterioConclusao} onChange={(e) => setForm({ ...form, criterioConclusao: e.target.value })} placeholder="Ex.: reunião agendada" className={campo} />
                <p className="mt-1 text-[11px] leading-snug text-muted">🎯 Ao acontecer, a IA marca a missão como <b>concluída</b>.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Informações autorizadas</label>
                <textarea value={form.informacoes} onChange={(e) => setForm({ ...form, informacoes: e.target.value })} rows={3} placeholder={form.informacoesDica} className={cn(campo, 'resize-none')} />
                <p className="mt-1 text-[11px] leading-snug text-muted">🛡️ A IA só afirma o que estiver aqui. Fora disso, ela confirma ou escala — nunca inventa.</p>
              </div>
              {/* Mídias desta missão — a IA envia quando o lead demonstrar interesse (§9 Fase A) */}
              <div>
                <label className="mb-1 block text-xs text-muted">📎 Mídias disponíveis nesta missão</label>
                <SeletorMidia valor={midiaIds} onChange={setMidiaIds} dica="Nada marcado → a IA pode enviar qualquer item da sua biblioteca quando fizer sentido." />
              </div>
              {/* Perfil de conversa — vem do modelo, ajustável (→ personalizado, salvo na missão) */}
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
                  <p className="mt-1 text-[11px] leading-snug text-muted">{form.modo === 'auto' ? 'A IA responde e envia sozinha.' : 'A IA rascunha e você aprova antes de enviar.'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Número (chip)</label>
                  <select value={form.numeroId} onChange={(e) => setForm({ ...form, numeroId: e.target.value })} className={campo}>
                    {numeros.length === 0 && <option value="">— nenhum número —</option>}
                    {numeros.map((n) => (
                      <option key={n.id} value={n.id} className="bg-slate-900">{rotuloNumero(n)}{n.apelido ? ` · +${n.telefone}` : ''} ({n.statusConexao})</option>
                    ))}
                  </select>
                </div>
              </div>
              {ehSuporte && (
                <button
                  type="button"
                  onClick={() => setReativo(!reativo)}
                  className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', reativo ? 'border-indigo-500/50 bg-indigo-500/[0.08]' : 'border-line bg-surface2 hover:border-line-strong')}
                >
                  <span className={cn('mt-0.5 grid h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', reativo ? 'bg-indigo-500' : 'bg-line-strong')}>
                    <span className={cn('h-4 w-4 rounded-full bg-white transition', reativo && 'translate-x-4')} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-content">🛟 Atender quem entrar em contato (24/7)</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">Qualquer pessoa que mandar mensagem pra esse número é atendida na hora por essa missão — mesmo sem estar na sua lista. Escolher contatos no próximo passo fica opcional.</span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* PASSO 3 — contatos + revisão */}
          {passo === 2 && (
            <div className="space-y-4 pt-1">
              {ehSuporte && reativo && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs leading-snug text-emerald-200/90">
                  🛟 <b>Suporte reativo ligado:</b> a IA já vai atender automaticamente quem mandar mensagem nesse número. Escolher contatos abaixo é <b>opcional</b> — serve só pra iniciar conversas proativamente também.
                </div>
              )}
              <SeletorContatos onChange={setContatos} />
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300/80">
                  <Rocket className="h-3.5 w-3.5" /> Resumo da missão
                </p>
                <ul className="space-y-1.5 text-sm text-content">
                  <li><span className="text-muted">Objetivo:</span> {form.objetivo || <span className="text-subtle">—</span>}</li>
                  <li><span className="text-muted">Perfil:</span> {estilo.perfil ?? 'Personalizado'}{estilo.bolhas ? ' · bolhas' : ''}{estilo.formalidade === 'informal' ? ' · informal' : estilo.formalidade === 'formal' ? ' · formal' : ''}</li>
                  {form.tom && <li><span className="text-muted">Tom:</span> {form.tom}</li>}
                  {form.criterioConclusao && <li><span className="text-muted">Conclui quando:</span> {form.criterioConclusao}</li>}
                  <li><span className="text-muted">Modo:</span> {form.modo === 'auto' ? '⚡ Auto (envia sozinha)' : '👁️ Co-pilot (você aprova)'}</li>
                  <li><span className="text-muted">Mídias:</span> {midiaIds.length > 0 ? `${midiaIds.length} anexada${midiaIds.length === 1 ? '' : 's'} — só essas` : 'toda a biblioteca disponível'}</li>
                  <li><span className="text-muted">Envio por:</span> {numeroSel ? rotuloNumero(numeroSel) : '—'}</li>
                  <li><span className="text-muted">Contatos:</span> {contatos.length > 0 ? `${contatos.length} — uma conversa por contato` : ehSuporte && reativo ? '🛟 reativo — atende quem entrar em contato' : <span className="text-subtle">nenhum ainda</span>}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* rodapé — navegação */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={() => (passo === 0 ? onFechar(false) : setPasso(passo - 1))}>
            {passo === 0 ? 'Cancelar' : (<><ArrowLeft className="h-4 w-4" /> Voltar</>)}
          </Button>
          {passo === 0 ? (
            <span className="text-xs text-subtle">Escolha um modelo pra continuar</span>
          ) : passo === 1 ? (
            <Button onClick={() => (form.objetivo.trim() ? setPasso(2) : toast('Descreva o objetivo.', 'erro'))}>
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={criar} loading={salvando}>
              <Rocket className="h-4 w-4" /> {ehSuporte && reativo && contatos.length === 0 ? 'Ativar suporte reativo' : contatos.length > 1 ? `Criar ${contatos.length} missões` : 'Criar missão'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
