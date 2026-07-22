// Sessão do painel: guarda token + usuário no localStorage.
export type Papel = 'super_admin' | 'admin_tenant' | 'operador'

export interface UsuarioSessao {
  id: string
  email: string
  papel: Papel
  tenantId: string | null
}

const KEY = 'zap_token'
const UKEY = 'zap_user'
let aoSair: (() => void) | null = null

export const auth = {
  token: () => localStorage.getItem(KEY),
  usuario: (): UsuarioSessao | null => {
    const s = localStorage.getItem(UKEY)
    return s ? (JSON.parse(s) as UsuarioSessao) : null
  },
  entrar: (token: string, usuario: UsuarioSessao) => {
    localStorage.setItem(KEY, token)
    localStorage.setItem(UKEY, JSON.stringify(usuario))
  },
  sair: () => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(UKEY)
    aoSair?.()
  },
  // App registra aqui para reagir a logout / 401
  onSair: (cb: () => void) => {
    aoSair = cb
  },
}
