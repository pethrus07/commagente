import { LayoutDashboard, LifeBuoy, LogOut, Smartphone, Target, Users, Zap } from 'lucide-react'
import { type ComponentType, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { UsuarioSessao } from '../lib/auth'
import { cn } from '../lib/ui'

const PAPEL_LABEL: Record<UsuarioSessao['papel'], string> = {
  super_admin: 'Super-admin',
  admin_tenant: 'Administrador',
  operador: 'Operador',
}

export type Page = 'dashboard' | 'numeros' | 'missoes' | 'escalados' | 'contatos'

const ITENS: { id: Page; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'missoes', label: 'Missões', icon: Target },
  { id: 'escalados', label: 'Escalados', icon: LifeBuoy },
  { id: 'contatos', label: 'Contatos', icon: Users },
  { id: 'numeros', label: 'Números', icon: Smartphone },
]

export function Sidebar({
  atual,
  onNavegar,
  usuario,
  onSair,
}: {
  atual: Page
  onNavegar: (p: Page) => void
  usuario: UsuarioSessao
  onSair: () => void
}) {
  const [escalados, setEscalados] = useState(0)
  useEffect(() => {
    const carregar = () =>
      api.stats().then((s) => setEscalados(s.missoesPorEstado.escalada ?? 0)).catch(() => {})
    carregar()
    const t = setInterval(carregar, 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/8 bg-white/[0.02] px-4 py-6">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Zap className="h-5 w-5 text-white" fill="currentColor" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">zapagente</p>
          <p className="text-[11px] text-slate-500">assistente WhatsApp</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {ITENS.map((item) => {
          const ativo = atual === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavegar(item.id)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                ativo
                  ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', ativo ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'escalados' && escalados > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                  {escalados}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-xs font-semibold text-indigo-300">
            {usuario.email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{usuario.email}</p>
            <p className="text-[11px] text-slate-500">{PAPEL_LABEL[usuario.papel]}</p>
          </div>
          <button
            onClick={onSair}
            title="Sair"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
