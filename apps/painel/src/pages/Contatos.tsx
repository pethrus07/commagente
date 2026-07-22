import { useEffect, useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import type { ContatoResumo } from '../lib/types'
import { Card, EmptyState, Spinner, tempoRelativo } from '../lib/ui'

export function Contatos() {
  const [contatos, setContatos] = useState<ContatoResumo[] | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    api.contatos()
      .then(setContatos)
      .catch((e) => toast((e as Error).message, 'erro'))
  }, [])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return contatos ?? []
    return (contatos ?? []).filter(
      (c) => (c.nome ?? '').toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '')),
    )
  }, [contatos, busca])

  if (contatos === null) {
    return <div className="grid place-items-center py-20"><Spinner className="h-6 w-6" /></div>
  }

  if (contatos.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        titulo="Nenhum contato ainda"
        texto="Os contatos aparecem aqui automaticamente quando você cria missões ou recebe mensagens."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
        />
        <span className="text-xs text-slate-500">{visiveis.length} de {contatos.length}</span>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 text-center font-medium">Missões</th>
              <th className="px-4 py-3 text-right font-medium">Criado</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-slate-300">
                      {(c.nome ?? '#').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-100">{c.nome ?? <span className="text-slate-500">sem nome</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-300">+{c.telefone}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400">{c.origem ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-300">{c.totalMissoes}</td>
                <td className="px-4 py-3 text-right text-xs text-slate-500">{tempoRelativo(c.criadoEm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
