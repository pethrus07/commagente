import { LayoutDashboard, Smartphone, Target, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '../lib/ui'

export type Page = 'dashboard' | 'numeros' | 'missoes'

const ITENS: { id: Page; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'missoes', label: 'Missões', icon: Target },
  { id: 'numeros', label: 'Números', icon: Smartphone },
]

export function Sidebar({ atual, onNavegar }: { atual: Page; onNavegar: (p: Page) => void }) {
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
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <p className="text-[11px] font-medium text-slate-400">Fase F0 · MVP</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          Modo A (missão dirigida) + anti-bloqueio + memória.
        </p>
      </div>
    </aside>
  )
}
