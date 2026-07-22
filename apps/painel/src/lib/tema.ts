export type Tema = 'dark' | 'light'
const KEY = 'zap_tema'

export function temaInicial(): Tema {
  const t = localStorage.getItem(KEY)
  return t === 'light' ? 'light' : 'dark'
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.theme = t
  localStorage.setItem(KEY, t)
}

// aplica cedo (evita flash antes do React montar)
aplicarTema(temaInicial())
