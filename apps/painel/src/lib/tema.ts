/**
 * Tema claro/escuro: lê a preferência do localStorage e a aplica em `data-theme` no <html>.
 * O padrão é escuro. Importado por main.tsx antes do React montar, para não piscar.
 */
export type Tema = 'dark' | 'light'
const KEY = 'zap_tema'

export function temaInicial(): Tema {
  const t = localStorage.getItem(KEY)
  return t === 'light' ? 'light' : 'dark' // padrão: escuro
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.theme = t
  localStorage.setItem(KEY, t)
}

// aplica cedo (evita flash antes do React montar)
aplicarTema(temaInicial())
