import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Search, Smartphone, Upload, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { ContatoResumo, Numero } from '../lib/types'
import { Button, Card, EmptyState, Spinner, tempoRelativo } from '../lib/ui'

const campo =
  'w-full rounded-xl border border-line bg-surface2 px-4 py-2 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

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

export function Contatos() {
  const [contatos, setContatos] = useState<ContatoResumo[] | null>(null)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<'novo' | 'whatsapp' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = () =>
    api.contatos.listar().then(setContatos).catch((e) => toast((e as Error).message, 'erro'))
  useEffect(() => {
    carregar()
  }, [])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return contatos ?? []
    const digitos = q.replace(/\D/g, '')
    // guard: sem ele, telefone.includes('') casa todos quando a busca é só texto
    return (contatos ?? []).filter(
      (c) => (c.nome ?? '').toLowerCase().includes(q) || (digitos.length > 0 && c.telefone.includes(digitos)),
    )
  }, [contatos, busca])

  const onCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo arquivo
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
          <Button variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> CSV</Button>
          <Button variant="ghost" onClick={() => setModal('whatsapp')}><Smartphone className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="ghost" onClick={exportar}><Download className="h-4 w-4" /> Exportar</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onCSV} className="hidden" />
        </div>
      </div>

      {contatos === null ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : contatos.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} titulo="Nenhum contato ainda" texto="Adicione um contato, importe do WhatsApp ou suba um CSV." acao={<Button onClick={() => setModal('novo')}><Plus className="h-4 w-4" /> Novo contato</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 text-center font-medium">Missões</th>
                <th className="px-4 py-3 text-right font-medium">Criado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">Nenhum contato encontrado para “{busca}”.</td></tr>
              )}
              {visiveis.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-xs font-semibold text-content">
                        {(c.nome ?? '#').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-content">{c.nome ?? <span className="text-muted">sem nome</span>}</span>
                      {c.optOut && <span className="rounded bg-rose-500/15 px-1.5 text-[10px] font-medium text-rose-300">opt-out</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-content">+{c.telefone}</td>
                  <td className="px-4 py-3"><span className="rounded-md bg-surface2 px-2 py-0.5 text-xs text-muted">{c.origem ?? '—'}</span></td>
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
    </div>
  )
}
