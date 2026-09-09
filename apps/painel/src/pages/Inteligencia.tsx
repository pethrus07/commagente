/**
 * A Central de Inteligência: perguntar em português sobre os dados da própria conta. A API
 * responde só com base num retrato agregado (grounded) — as perguntas-semente estão aqui para
 * tirar o usuário do zero, porque campo de texto vazio não convida ninguém.
 */
import { useEffect, useRef, useState } from 'react'
import { Brain, Send, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { Spinner, cn } from '../lib/ui'

// Perguntas-semente pra tirar o usuário do zero (a IA responde sobre os dados reais da conta).
const SUGESTOES = [
  'Como está a conta agora, no geral?',
  'Qual campanha está convertendo mais?',
  'Quem prometeu pagar e ainda não pagou?',
  'Quantas conversas estão ativas?',
  'Quantas mensagens foram trocadas hoje?',
]

type Msg = { autor: 'voce' | 'ia'; texto: string }

// Central de Inteligência (#7): pergunte qualquer coisa sobre os dados; a IA busca no retrato
// real da conta e responde (grounded — não inventa número).
export function Inteligencia() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [pergunta, setPergunta] = useState('')
  const [pensando, setPensando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, pensando])

  const perguntar = async (q: string) => {
    const texto = q.trim()
    if (!texto || pensando) return
    setMsgs((m) => [...m, { autor: 'voce', texto }])
    setPergunta('')
    setPensando(true)
    try {
      const { resposta } = await api.inteligencia.perguntar(texto)
      setMsgs((m) => [...m, { autor: 'ia', texto: resposta }])
    } catch (e) {
      setMsgs((m) => [...m, { autor: 'ia', texto: `⚠️ ${(e as Error).message}` }])
    } finally {
      setPensando(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {msgs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300"><Brain className="h-7 w-7" /></div>
          <div>
            <h2 className="text-lg font-semibold text-content">Pergunte qualquer coisa sobre a conta</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">A IA olha os dados reais do sistema — missões, campanhas, contatos, desfechos — e responde. Ela não inventa número: se o dado ainda não existe, ela diz.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => perguntar(s)} className="rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs text-muted transition hover:border-indigo-500/40 hover:text-content">{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.autor === 'voce' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.autor === 'voce' ? 'bg-indigo-500 text-white' : 'border border-line bg-surface text-content')}>
                {m.autor === 'ia' && <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-indigo-300"><Sparkles className="h-3 w-3" /> Inteligência</div>}
                <p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-muted"><Spinner className="h-4 w-4" /> analisando os dados…</div>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
        <textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); perguntar(pergunta) } }}
          rows={1}
          placeholder="Pergunte sobre suas conversas, campanhas, contatos…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none"
        />
        <button onClick={() => perguntar(pergunta)} disabled={pensando || !pergunta.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40" aria-label="Perguntar">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
