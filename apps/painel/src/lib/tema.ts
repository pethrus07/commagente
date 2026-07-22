export type Tema = 'dark' | 'light'
const KEY = 'zap_tema'

export function temaInicial(): Tema {
  // Dark é o único tema 100% suportado hoje; forçamos dark (sobrescreve qualquer
  // 'light' salvo de testes antigos) até o tema claro cobrir todas as páginas.
  return 'dark'
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.theme = t
  localStorage.setItem(KEY, t)
}

// aplica cedo (evita flash antes do React montar)
aplicarTema(temaInicial())
