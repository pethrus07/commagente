import { useState } from 'react'
import { LogIn, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { auth, type UsuarioSessao } from '../lib/auth'
import { toast } from '../lib/toast'
import { Button } from '../lib/ui'

export function Login({ onEntrar }: { onEntrar: (u: UsuarioSessao) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)

  const entrar = async () => {
    if (!email.trim() || !senha) return toast('Preencha e-mail e senha.', 'erro')
    setEntrando(true)
    try {
      const { token, usuario } = await api.login(email.trim(), senha)
      auth.entrar(token, usuario)
      onEntrar(usuario)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setEntrando(false)
    }
  }

  const campo =
    'w-full rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm text-content placeholder:text-subtle focus:border-indigo-500/50 focus:outline-none'

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Zap className="h-7 w-7 text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-content">zapagente</h1>
            <p className="text-sm text-muted">Assistente de WhatsApp com IA</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5">
          <div>
            <label className="mb-1 block text-xs text-muted">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              placeholder="voce@empresa.com"
              className={campo}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              placeholder="••••••••"
              className={campo}
            />
          </div>
          <Button className="mt-1 w-full" onClick={entrar} loading={entrando}>
            <LogIn className="h-4 w-4" /> Entrar
          </Button>
        </div>
      </div>
    </div>
  )
}
