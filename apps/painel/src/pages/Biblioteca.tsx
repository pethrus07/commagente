import { useEffect, useRef, useState } from 'react'
import { FileText, FileUp, Paperclip, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { Midia } from '../lib/types'
import { Button, Card, EmptyState, Spinner } from '../lib/ui'

const lerBase64 = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Falha ao ler o arquivo'))
    r.readAsDataURL(file)
  })

const fmt = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

// Biblioteca de mídia (§8.15): arquivos "bonitos" (catálogo, tabela de preço, PDF) que a IA
// pode ENVIAR ao contato no momento certo. É a SAÍDA da IA — separado do DNA (o que ela sabe).
export function Biblioteca() {
  const [midias, setMidias] = useState<Midia[] | null>(null)
  const [subindo, setSubindo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = () => api.midia.listar().then(setMidias).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => { carregar() }, [])

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSubindo(true)
    try {
      const base64 = await lerBase64(file)
      const nome = file.name.replace(/\.[^.]+$/, '')
      await api.midia.subir({ nome, mimetype: file.type || 'application/octet-stream', base64 })
      toast(`"${nome}" na biblioteca.`, 'ok')
      carregar()
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setSubindo(false)
    }
  }
  const excluir = async (id: string) => { try { await api.midia.excluir(id); carregar() } catch (e) { toast((e as Error).message, 'erro') } }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <input ref={fileRef} type="file" accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt" onChange={onArquivo} className="hidden" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Arquivos que a IA <b className="text-content">envia</b> sozinha, no momento certo (catálogo, tabela de preço, apresentação).</p>
        <Button onClick={() => fileRef.current?.click()} loading={subindo}><FileUp className="h-4 w-4" /> Subir arquivo</Button>
      </div>

      {midias === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : midias.length === 0 ? (
        <EmptyState icon={<Paperclip className="h-6 w-6" />} titulo="Biblioteca vazia" texto="Suba o catálogo, a tabela de preços ou uma apresentação — a IA envia quando o lead se interessar." acao={<Button onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Subir arquivo</Button>} />
      ) : (
        <div className="space-y-2">
          {midias.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400"><FileText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{m.nome}</p>
                <p className="text-[11px] text-subtle">{m.mimetype} · {fmt(m.tamanho)}</p>
              </div>
              <button onClick={() => excluir(m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface2 hover:text-rose-500" title="Remover"><Trash2 className="h-4 w-4" /></button>
            </Card>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-snug text-subtle">A IA decide o momento (quando o lead se interessa; não logo de cara, e não repete a mesma pro mesmo contato). Mídia pesa no anti-bloqueio — use com parcimônia.</p>
    </div>
  )
}
