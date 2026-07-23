import { useEffect, useState } from 'react'
import { ChevronRight, LifeBuoy, MessageSquare } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Missao } from '../lib/types'
import { Button, Card, EmptyState, Spinner, tempoRelativo } from '../lib/ui'

export function Escalados({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [itens, setItens] = useState<Missao[] | null>(null)
  const [assumindo, setAssumindo] = useState<string | null>(null)

  const carregar = async () => {
    try {
      setItens(await api.escalados())
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 6000)
    return () => clearInterval(t)
  }, [])

  const assumir = async (id: string) => {
    setAssumindo(id)
    try {
      await api.missoes.assumir(id)
      toast('Você assumiu a conversa — a IA está pausada. 🤝', 'ok')
      onAbrir(id)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setAssumindo(null)
    }
  }

  if (itens === null) {
    return <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        icon={<LifeBuoy className="h-6 w-6" />}
        titulo="Nenhuma conversa escalada"
        texto="Quando a IA precisar de um humano (ex.: uma pergunta que ela não pode responder sozinha), a conversa aparece aqui."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {itens.length} conversa{itens.length > 1 ? 's' : ''} aguardando você. A IA já pausou nelas.
      </p>
      {itens.map((m) => {
        const ultima = m.mensagens?.[0]
        return (
          <Card key={m.id} className="border-rose-500/25 bg-rose-500/[0.06] p-4">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-content">
                    {m.contato?.nome ?? `+${m.contato?.telefone ?? '—'}`}
                  </p>
                  <span className="text-xs text-muted">· {tempoRelativo(m.criadoEm)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{m.objetivo}</p>
                {m.motivoEscala && (
                  <p className="mt-1.5 inline-block rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-200">
                    Motivo: {m.motivoEscala}
                  </p>
                )}
                {ultima && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-content">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                    <span className="line-clamp-2">{ultima.conteudo}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Button onClick={() => assumir(m.id)} loading={assumindo === m.id}>
                  Assumir
                </Button>
                <button
                  onClick={() => onAbrir(m.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-content"
                >
                  Abrir <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
