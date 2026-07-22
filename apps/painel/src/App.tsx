import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { auth, type UsuarioSessao } from './lib/auth'
import { useToasts } from './lib/toast'
import { cn } from './lib/ui'
import { Contatos } from './pages/Contatos'
import { Dashboard } from './pages/Dashboard'
import { Escalados } from './pages/Escalados'
import { Login } from './pages/Login'
import { MissaoDetalhe } from './pages/MissaoDetalhe'
import { Missoes } from './pages/Missoes'
import { Numeros } from './pages/Numeros'

type Rota = { page: Page } | { page: 'missao'; id: string }

const TITULOS: Record<Page, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Visão geral do assistente' },
  missoes: { t: 'Missões', s: 'Conversas conduzidas pela IA' },
  escalados: { t: 'Escalados', s: 'Conversas que a IA entregou pra você' },
  contatos: { t: 'Contatos', s: 'Leads e clientes (CRM)' },
  numeros: { t: 'Números', s: 'Chips conectados via Evolution' },
}

export default function App() {
  const [rota, setRota] = useState<Rota>({ page: 'dashboard' })
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(auth.usuario())
  const toasts = useToasts()
  const pageAtual: Page = rota.page === 'missao' ? 'missoes' : rota.page
  const titulo = TITULOS[pageAtual]

  // logout / token expirado (401) → volta pra tela de login
  useEffect(() => {
    auth.onSair(() => setUsuario(null))
  }, [])

  const sair = () => {
    auth.sair()
    setRota({ page: 'dashboard' })
  }

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
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-white/8 px-8 py-5">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-white">{titulo.t}</h1>
                <p className="text-sm text-slate-500">{titulo.s}</p>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
              {rota.page === 'dashboard' && <Dashboard />}
              {rota.page === 'numeros' && <Numeros />}
              {rota.page === 'contatos' && <Contatos />}
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
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/15 text-rose-200',
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
