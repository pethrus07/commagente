// Sessão do painel: guarda token + usuário no localStorage.
export type Papel = 'super_admin' | 'admin_tenant' | 'operador'

export interface UsuarioSessao {
  id: string
  email: string
  papel: Papel
  tenantId: string | null
  aceitouTermos?: boolean // aceite dos termos (LGPD/responsabilidade do número)
}

const KEY = 'zap_token'
const UKEY = 'zap_user'
const TKEY = 'zap_tenant' // tenant selecionado pelo super-admin (impersonação)
let aoSair: (() => void) | null = null

export interface TenantSel {
  id: string
  nome: string
}

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
  // atualiza só o usuário na sessão (ex.: sincronizar aceite de termos do /auth/eu)
  setUsuario: (usuario: UsuarioSessao) => localStorage.setItem(UKEY, JSON.stringify(usuario)),
  // marca os termos como aceitos na sessão local (backend já registrou o timestamp)
  marcarTermosAceitos: (): UsuarioSessao | null => {
    const s = localStorage.getItem(UKEY)
    if (!s) return null
    const u = { ...(JSON.parse(s) as UsuarioSessao), aceitouTermos: true }
    localStorage.setItem(UKEY, JSON.stringify(u))
    return u
  },
  sair: () => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(UKEY)
    localStorage.removeItem(TKEY)
    aoSair?.()
  },
  // App registra aqui para reagir a logout / 401
  onSair: (cb: () => void) => {
    aoSair = cb
  },
  // tenant que o super-admin está visualizando (null = tenant padrão)
  tenantSel: (): TenantSel | null => {
    const s = localStorage.getItem(TKEY)
    return s ? (JSON.parse(s) as TenantSel) : null
  },
  setTenantSel: (t: TenantSel | null) => {
    if (t) localStorage.setItem(TKEY, JSON.stringify(t))
    else localStorage.removeItem(TKEY)
  },
}
