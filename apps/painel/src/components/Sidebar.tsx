import {
  Building2,
  CalendarClock,
  Dna,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Moon,
  Smartphone,
  Sun,
  Tag,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { type ComponentType, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { TenantSel, UsuarioSessao } from '../lib/auth'
import { aplicarTema, type Tema, temaInicial } from '../lib/tema'
import type { TenantResumo } from '../lib/types'
import { cn } from '../lib/ui'

const PAPEL_LABEL: Record<UsuarioSessao['papel'], string> = {
  super_admin: 'Super-admin',
  admin_tenant: 'Administrador',
  operador: 'Operador',
}

type Item = {
  id: Page
  label: string
  icon: ComponentType<{ className?: string }>
  soSuperAdmin?: boolean
}
export type Page =
  | 'dashboard'
  | 'numeros'
  | 'missoes'
  | 'campanhas'
  | 'programadas'
  | 'escalados'
  | 'contatos'
  | 'tags'
  | 'conhecimento'
  | 'tenants'

const ITENS: Item[] = [
  { id: 'tenants', label: 'Tenants', icon: Building2, soSuperAdmin: true },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'missoes', label: 'Missões', icon: Target },
  { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
  { id: 'programadas', label: 'Programadas', icon: CalendarClock },
  { id: 'escalados', label: 'Escalados', icon: LifeBuoy },
  { id: 'contatos', label: 'Contatos', icon: Users },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'conhecimento', label: 'DNA & Conhecimento', icon: Dna },
  { id: 'numeros', label: 'Números', icon: Smartphone },
]

export function Sidebar({
  atual,
  onNavegar,
  usuario,
  onSair,
  tenantSel,
  onTrocarTenant,
}: {
  atual: Page
  onNavegar: (p: Page) => void
  usuario: UsuarioSessao
  onSair: () => void
  tenantSel: TenantSel | null
  onTrocarTenant: (t: TenantSel | null) => void
}) {
  const ehSuper = usuario.papel === 'super_admin'
  const [escalados, setEscalados] = useState(0)
  const [tenants, setTenants] = useState<TenantResumo[]>([])
  const [tema, setTema] = useState<Tema>(temaInicial())

  useEffect(() => {
    const carregar = () =>
      api.stats().then((s) => setEscalados(s.missoesPorEstado.escalada ?? 0)).catch(() => {})
    carregar()
    const t = setInterval(carregar, 8000)
    return () => clearInterval(t)
  }, [tenantSel])

  useEffect(() => {
    if (ehSuper) api.admin.tenants().then(setTenants).catch(() => {})
  }, [ehSuper])

  const trocarTema = () => {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark'
    aplicarTema(novo)
    setTema(novo)
  }

  const itens = ITENS.filter((i) => !i.soSuperAdmin || ehSuper)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Zap className="h-5 w-5 text-white" fill="currentColor" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-content">Commagente</p>
          <p className="text-[11px] text-subtle">assistente WhatsApp</p>
        </div>
      </div>

      {ehSuper && (
        <div className="mb-5">
          <label className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-subtle">
            <Building2 className="h-3 w-3" /> Visualizando
          </label>
          <select
            value={tenantSel?.id ?? ''}
            onChange={(e) => {
              const t = tenants.find((x) => x.id === e.target.value)
              onTrocarTenant(t ? { id: t.id, nome: t.nome } : null)
            }}
            className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-content focus:border-indigo-500/60 focus:outline-none"
          >
            <option value="">Tenant padrão</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {itens.map((item) => {
          const ativo = atual === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavegar(item.id)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                ativo
                  ? 'bg-indigo-500/15 text-indigo-700 ring-1 ring-inset ring-indigo-500/30 dark:text-white'
                  : 'text-muted hover:bg-surface2 hover:text-content',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', ativo ? 'text-indigo-500 dark:text-indigo-400' : 'text-subtle group-hover:text-content')} />
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

      <button
        onClick={trocarTema}
        className="mt-4 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface2 hover:text-content"
      >
        {tema === 'dark' ? <Sun className="h-[18px] w-[18px] text-subtle" /> : <Moon className="h-[18px] w-[18px] text-subtle" />}
        {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </button>

      <div className="mt-2 rounded-xl border border-line bg-surface2 p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {usuario.email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-content">{usuario.email}</p>
            <p className="text-[11px] text-subtle">{PAPEL_LABEL[usuario.papel]}</p>
          </div>
          <button
            onClick={onSair}
            title="Sair"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-subtle transition hover:bg-surface hover:text-rose-500"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
