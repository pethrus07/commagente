// 💛 Domínio puro — fatiamento de texto p/ RAG.
// Quebra um conteúdo (ex.: PDF inteiro) em trechos de ~alvo chars, respeitando
// fronteiras de sentença quando dá, pra cada trecho virar um embedding recuperável.
export function dividirEmChunks(texto: string, alvo = 600, maxChunks = 120): string[] {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (!limpo) return []
  if (limpo.length <= alvo) return [limpo]

  const sentencas = limpo.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let atual = ''

  const empurra = () => {
    const t = atual.trim()
    if (t) chunks.push(t)
    atual = ''
  }

  for (const s of sentencas) {
    // sentença gigante (texto sem pontuação) → corta em pedaços de `alvo`
    if (s.length > alvo) {
      empurra()
      for (let i = 0; i < s.length; i += alvo) chunks.push(s.slice(i, i + alvo).trim())
      continue
    }
    if (atual && atual.length + s.length + 1 > alvo) empurra()
    atual = atual ? `${atual} ${s}` : s
  }
  empurra()
  return chunks.slice(0, maxChunks)
}
