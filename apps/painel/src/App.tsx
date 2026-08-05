import { CheckCircle2, Menu, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { TermosModal } from './components/TermosModal'
import { api } from './lib/api'
import { auth, type TenantSel, type UsuarioSessao } from './lib/auth'
import { useToasts } from './lib/toast'
import { cn } from './lib/ui'
import { Campanhas } from './pages/Campanhas'
import { DNA } from './pages/DNA'
import { VozEstilo } from './pages/VozEstilo'
import { Biblioteca } from './pages/Biblioteca'
import { Contatos } from './pages/Contatos'
import { Dashboard } from './pages/Dashboard'
import { Escalados } from './pages/Escalados'
import { Login } from './pages/Login'
import { MissaoDetalhe } from './pages/MissaoDetalhe'
import { Missoes } from './pages/Missoes'
import { Numeros } from './pages/Numeros'
import { Programadas } from './pages/Programadas'
import { Tags } from './pages/Tags'
import { Tenants } from './pages/Tenants'

type Rota = { page: Page } | { page: 'missao'; id: string }

const TITULOS: Record<Page, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Visão geral do assistente' },
  missoes: { t: 'Missões', s: 'Conversas conduzidas pela IA' },
  campanhas: { t: 'Campanhas', s: 'A mesma missão disparada pra vários contatos' },
  programadas: { t: 'Programadas', s: 'Missões que disparam sozinhas na data de cada cliente' },
  escalados: { t: 'Escalados', s: 'Conversas que a IA entregou pra você' },
  contatos: { t: 'Contatos', s: 'Leads e clientes (CRM)' },
  tags: { t: 'Tags', s: 'Rótulos que viram conhecimento pra IA sobre o contato' },
  dna: { t: 'DNA', s: 'O que a IA sabe e pode afirmar sobre a empresa' },
  voz: { t: 'Voz & estilo', s: 'Como a IA fala — a voz da marca e o jeito de escrever' },
  biblioteca: { t: 'Biblioteca', s: 'Arquivos que a IA envia (catálogo, cardápio, tabela, áudio, apresentação…)' },
  numeros: { t: 'Números', s: 'Chips conectados via Evolution' },
  tenants: { t: 'Tenants', s: 'Clientes da plataforma' },
}

export default function App() {
  const [rota, setRota] = useState<Rota>({ page: 'dashboard' })
  const [menuAberto, setMenuAberto] = useState(false) // drawer da sidebar no celular
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(auth.usuario())
  const [tenantSel, setTenantSel] = useState<TenantSel | null>(auth.tenantSel())
  const toasts = useToasts()
  const pageAtual: Page = rota.page === 'missao' ? 'missoes' : rota.page
  const titulo = TITULOS[pageAtual]

  // logout / token expirado (401) → volta pra tela de login
  useEffect(() => {
    auth.onSair(() => setUsuario(null))
    // sincroniza o usuário com o servidor (sessão antiga em cache pode não ter o
    // aceite de termos) — assim o modal não reaparece pra quem já aceitou.
    if (auth.usuario()) {
      api
        .eu()
        .then(({ usuario: u }) => {
          auth.setUsuario(u)
          setUsuario(u)
        })
        .catch(() => {})
    }
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
        <>
          {/* aceite de termos obrigatório no 1º acesso (não vale p/ o super-admin/plataforma) */}
          {usuario.papel !== 'super_admin' && !usuario.aceitouTermos && (
            <TermosModal onAceitar={setUsuario} onSair={sair} />
          )}
          <div className="flex h-screen">
          <Sidebar
            atual={pageAtual}
            onNavegar={(p) => setRota({ page: p })}
            usuario={usuario}
            onSair={sair}
            tenantSel={tenantSel}
            onTrocarTenant={trocarTenant}
            mobileAberta={menuAberto}
            onFechar={() => setMenuAberto(false)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-5 md:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setMenuAberto(true)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-content md:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-content">{titulo.t}</h1>
                  <p className="truncate text-sm text-muted">{titulo.s}</p>
                </div>
              </div>
              {escopo && (
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  {escopo}
                </span>
              )}
            </header>

            {/* key por tenant: trocar de tenant remonta e recarrega as páginas */}
            <main key={tenantSel?.id ?? 'padrao'} className="flex-1 overflow-y-auto p-4 md:p-8">
              {rota.page === 'tenants' && <Tenants onVerTenant={trocarTenant} />}
              {rota.page === 'dashboard' && <Dashboard />}
              {rota.page === 'numeros' && <Numeros />}
              {rota.page === 'contatos' && <Contatos />}
              {rota.page === 'tags' && <Tags />}
              {rota.page === 'dna' && <DNA />}
              {rota.page === 'voz' && <VozEstilo />}
              {rota.page === 'biblioteca' && <Biblioteca />}
              {rota.page === 'escalados' && <Escalados onAbrir={(id) => setRota({ page: 'missao', id })} />}
              {rota.page === 'missoes' && <Missoes onAbrir={(id) => setRota({ page: 'missao', id })} />}
              {rota.page === 'campanhas' && <Campanhas />}
              {rota.page === 'programadas' && <Programadas />}
              {rota.page === 'missao' && <MissaoDetalhe id={rota.id} onVoltar={() => setRota({ page: 'missoes' })} />}
            </main>
          </div>
          </div>
        </>
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
