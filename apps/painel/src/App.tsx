import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { auth, type TenantSel, type UsuarioSessao } from './lib/auth'
import { useToasts } from './lib/toast'
import { cn } from './lib/ui'
import { Conhecimento } from './pages/Conhecimento'
import { Contatos } from './pages/Contatos'
import { Dashboard } from './pages/Dashboard'
import { Escalados } from './pages/Escalados'
import { Login } from './pages/Login'
import { MissaoDetalhe } from './pages/MissaoDetalhe'
import { Missoes } from './pages/Missoes'
import { Numeros } from './pages/Numeros'
import { Tenants } from './pages/Tenants'

type Rota = { page: Page } | { page: 'missao'; id: string }

const TITULOS: Record<Page, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Visão geral do assistente' },
  missoes: { t: 'Missões', s: 'Conversas conduzidas pela IA' },
  escalados: { t: 'Escalados', s: 'Conversas que a IA entregou pra você' },
  contatos: { t: 'Contatos', s: 'Leads e clientes (CRM)' },
  conhecimento: { t: 'Conhecimento', s: 'Memória coletiva — o que a IA aprende' },
  numeros: { t: 'Números', s: 'Chips conectados via Evolution' },
  tenants: { t: 'Tenants', s: 'Clientes da plataforma' },
}

export default function App() {
  const [rota, setRota] = useState<Rota>({ page: 'dashboard' })
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(auth.usuario())
  const [tenantSel, setTenantSel] = useState<TenantSel | null>(auth.tenantSel())
  const toasts = useToasts()
  const pageAtual: Page = rota.page === 'missao' ? 'missoes' : rota.page
  const titulo = TITULOS[pageAtual]

  // logout / token expirado (401) → volta pra tela de login
  useEffect(() => {
    auth.onSair(() => setUsuario(null))
  }, [])

  const sair = () => {
    auth.sair()
    setTenantSel(null)
    setRota({ page: 'dashboard' })
  }

  const trocarTenant = (t: TenantSel | null) => {
    auth.setTenantSel(t)
    setTenantSel(t)
    setRota({ page: 'dashboard' })
  }

  // rótulo do tenant em foco (para o super-admin saber o que está vendo)
  const escopo = usuario?.papel === 'super_admin' ? tenantSel?.nome ?? 'Tenant padrão' : null

  return (
    <>
      {!usuario ? (
        <Login onEntrar={setUsuario} />
      ) : (
        <div className="flex h-screen">
          <Sidebar
            atual={pageAtual}
            onNavegar={(p) => setRota({ page: p })}
            usuario={usuario}
            onSair={sair}
            tenantSel={tenantSel}
            onTrocarTenant={trocarTenant}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-line px-8 py-5">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-content">{titulo.t}</h1>
                <p className="text-sm text-muted">{titulo.s}</p>
              </div>
              {escopo && (
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  {escopo}
                </span>
              )}
            </header>

            {/* key por tenant: trocar de tenant remonta e recarrega as páginas */}
            <main key={tenantSel?.id ?? 'padrao'} className="flex-1 overflow-y-auto p-8">
              {rota.page === 'tenants' && <Tenants onVerTenant={trocarTenant} />}
              {rota.page === 'dashboard' && <Dashboard />}
              {rota.page === 'numeros' && <Numeros />}
              {rota.page === 'contatos' && <Contatos />}
              {rota.page === 'conhecimento' && <Conhecimento />}
              {rota.page === 'escalados' && <Escalados onAbrir={(id) => setRota({ page: 'missao', id })} />}
              {rota.page === 'missoes' && <Missoes onAbrir={(id) => setRota({ page: 'missao', id })} />}
              {rota.page === 'missao' && <MissaoDetalhe id={rota.id} onVoltar={() => setRota({ page: 'missoes' })} />}
            </main>
          </div>
        </div>
      )}

      {/* toaster (sempre montado, inclusive no login) */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl',
              t.tipo === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-200',
            )}
          >
            {t.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {t.msg}
          </div>
        ))}
      </div>
    </>
  )
}
