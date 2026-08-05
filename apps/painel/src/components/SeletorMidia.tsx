import { useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, Music, Paperclip, Video } from 'lucide-react'
import { api } from '../lib/api'
import type { Midia } from '../lib/types'
import { cn } from '../lib/ui'

// ícone conforme o tipo do arquivo (a IA/entrega envia inline conforme o mimetype)
export function IconeMidia({ mime }: { mime: string }) {
  const c = 'h-4 w-4 shrink-0'
  if (mime.startsWith('image/')) return <ImageIcon className={cn(c, 'text-emerald-300')} />
  if (mime.startsWith('audio/')) return <Music className={cn(c, 'text-violet-300')} />
  if (mime.startsWith('video/')) return <Video className={cn(c, 'text-sky-300')} />
  return <FileText className={cn(c, 'text-amber-300')} />
}

/**
 * Seletor de mídia da biblioteca (§9 Fase A): escolhe QUAIS arquivos ficam disponíveis
 * nesta missão/campanha/programada. Vazio = toda a biblioteca do tenant (padrão).
 * Devolve os ids selecionados via onChange.
 */
export function SeletorMidia({
  valor,
  onChange,
  dica,
}: {
  valor: string[]
  onChange: (ids: string[]) => void
  dica?: string
}) {
  const [midias, setMidias] = useState<Midia[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.midia
      .listar()
      .then(setMidias)
      .catch(() => setMidias([]))
      .finally(() => setCarregando(false))
  }, [])

  const alternar = (id: string) =>
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])

  if (carregando) return <p className="text-[11px] text-subtle">Carregando biblioteca…</p>

  if (midias.length === 0)
    return (
      <p className="text-[11px] leading-snug text-subtle">
        Sua biblioteca de mídia está vazia. Suba arquivos em <b>Biblioteca</b> (catálogo, tabela de
        preço, áudio, boleto…) pra poder anexá-los aqui.
      </p>
    )

  const nenhum = valor.length === 0
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {midias.map((m) => {
          const on = valor.includes(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => alternar(m.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                on
                  ? 'border-indigo-500/50 bg-indigo-500/[0.12] text-indigo-100'
                  : 'border-line bg-surface2 text-muted hover:border-line-strong hover:text-content',
              )}
              title={m.nome}
            >
              <IconeMidia mime={m.mimetype} />
              <span className="max-w-[160px] truncate">{m.nome}</span>
            </button>
          )
        })}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted">
        <Paperclip className="mt-0.5 h-3 w-3 shrink-0" />
        {nenhum
          ? (dica ??
            'Nada marcado → a IA pode oferecer QUALQUER item da biblioteca quando fizer sentido.')
          : `${valor.length} selecionada${valor.length === 1 ? '' : 's'} — só essas ficam disponíveis aqui.`}
      </p>
    </div>
  )
}
