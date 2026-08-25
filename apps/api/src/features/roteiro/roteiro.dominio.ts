// 💛 Domínio — o MODO ROTEIRO (sequência guiada). Regra PURA, sem I/O.
// O harness dirige a sequência (determinístico); a IA cuida da língua/extração/desvios.

export type PassoPergunta = { tipo: 'pergunta'; texto: string; campo?: string }
export type OpcaoMenu = { rotulo: string; passos: PassoPergunta[] }
export type PassoMenu = { tipo: 'menu'; texto: string; opcoes: OpcaoMenu[] }
export type Passo = PassoPergunta | PassoMenu

export type Roteiro = {
  aberturaFixa?: string
  resumoFinal?: boolean
  passos: Passo[]
}

// progresso de UMA missão dentro do roteiro (guardado em Missao.roteiroEstado)
export type RoteiroEstado = { ramo: string | null; idx: number }
export const ROTEIRO_INICIO: RoteiroEstado = { ramo: null, idx: 0 }

// lê o estado bruto do banco de forma tolerante (null/malformado → início)
export function lerEstado(bruto: unknown): RoteiroEstado {
  if (bruto && typeof bruto === 'object') {
    const x = bruto as Record<string, unknown>
    return {
      ramo: typeof x.ramo === 'string' && x.ramo.trim() ? x.ramo : null,
      idx: typeof x.idx === 'number' && x.idx >= 0 ? Math.floor(x.idx) : 0,
    }
  }
  return { ...ROTEIRO_INICIO }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// Normaliza/valida o JSON bruto do banco. Devolve null se não há passos válidos (= conversa livre).
export function lerRoteiro(bruto: unknown): Roteiro | null {
  if (!bruto || typeof bruto !== 'object') return null
  const r = bruto as Record<string, unknown>
  const passos = (Array.isArray(r.passos) ? r.passos : []).map(lerPasso).filter((p): p is Passo => !!p)
  if (passos.length === 0) return null
  return {
    aberturaFixa: str(r.aberturaFixa) || undefined,
    resumoFinal: r.resumoFinal === true,
    passos,
  }
}

function lerPasso(p: unknown): Passo | null {
  if (!p || typeof p !== 'object') return null
  const x = p as Record<string, unknown>
  if (x.tipo === 'menu') {
    const texto = str(x.texto)
    const opcoes = (Array.isArray(x.opcoes) ? x.opcoes : []).map(lerOpcao).filter((o): o is OpcaoMenu => !!o)
    return texto && opcoes.length > 0 ? { tipo: 'menu', texto, opcoes } : null
  }
  return lerPergunta(x)
}

function lerPergunta(x: Record<string, unknown>): PassoPergunta | null {
  const texto = str(x.texto)
  if (!texto) return null
  const campo = str(x.campo)
  return { tipo: 'pergunta', texto, ...(campo ? { campo } : {}) }
}

function lerOpcao(o: unknown): OpcaoMenu | null {
  if (!o || typeof o !== 'object') return null
  const x = o as Record<string, unknown>
  const rotulo = str(x.rotulo)
  if (!rotulo) return null
  // v1: 1 nível — a opção só contém perguntas (nada de menu aninhado)
  const passos = (Array.isArray(x.passos) ? x.passos : [])
    .map((p) => (p && typeof p === 'object' ? lerPergunta(p as Record<string, unknown>) : null))
    .filter((p): p is PassoPergunta => !!p)
  return { rotulo, passos }
}

// a lista de passos "ativa" agora: a principal, ou a sub-lista da opção de menu escolhida
function listaAtiva(roteiro: Roteiro, estado: RoteiroEstado): Passo[] {
  if (!estado.ramo) return roteiro.passos
  for (const p of roteiro.passos) {
    if (p.tipo === 'menu') {
      const op = p.opcoes.find((o) => o.rotulo === estado.ramo)
      if (op) return op.passos
    }
  }
  return [] // ramo desconhecido → tratado como fim
}

// passo atual (ou null = roteiro concluído)
export function passoAtual(roteiro: Roteiro, estado: RoteiroEstado): { passo: Passo; ehUltimo: boolean } | null {
  const lista = listaAtiva(roteiro, estado)
  if (estado.idx < 0 || estado.idx >= lista.length) return null
  return { passo: lista[estado.idx], ehUltimo: estado.idx === lista.length - 1 }
}

// casa a escolha da IA (rótulo) com uma opção do menu (exato, senão por conteúdo)
function casarOpcao(menu: PassoMenu, escolha: string | null | undefined): OpcaoMenu | null {
  const e = str(escolha).toLowerCase()
  if (!e) return null
  return (
    menu.opcoes.find((o) => o.rotulo.toLowerCase() === e) ??
    menu.opcoes.find((o) => o.rotulo.toLowerCase().includes(e) || e.includes(o.rotulo.toLowerCase())) ??
    null
  )
}

// calcula o PRÓXIMO estado a partir da saída da IA deste turno (fatos já mesclados + escolha de menu)
export function avancar(
  roteiro: Roteiro,
  estado: RoteiroEstado,
  saida: { fatos?: Record<string, unknown> | null; opcaoRoteiro?: string | null },
): RoteiroEstado {
  const atual = passoAtual(roteiro, estado)
  if (!atual) return estado
  if (atual.passo.tipo === 'menu') {
    const escolha = casarOpcao(atual.passo, saida.opcaoRoteiro)
    return escolha ? { ramo: escolha.rotulo, idx: 0 } : estado // sem escolha clara → repete o menu
  }
  // pergunta com campo: só avança se o dado foi capturado (senão foi desvio/não respondeu → fica)
  if (atual.passo.campo) {
    const v = saida.fatos?.[atual.passo.campo]
    if (v == null || String(v).trim() === '') return estado
  }
  return { ...estado, idx: estado.idx + 1 }
}

// espia o texto do PRÓXIMO passo — mas só se for uma pergunta (menu/fim são apresentados no seu
// próprio turno). Usado pra encadear "agradeça e já pergunte o próximo" numa mensagem só.
function proximaPergunta(roteiro: Roteiro, estado: RoteiroEstado): string | null {
  const prox = passoAtual(roteiro, { ...estado, idx: estado.idx + 1 })
  return prox && prox.passo.tipo === 'pergunta' ? prox.passo.texto : null
}

// monta a instrução do passo atual pro prompt (o texto que a IA recebe). null = roteiro no fim.
// O ponteiro só avança DEPOIS do turno, então a instrução também diz o que fazer quando o cliente
// ACABOU de responder este passo (agradecer + já emendar o próximo) — senão a conversa trava numa
// mensagem sem saída ("Prazer!" e ponto).
export function instrucaoRoteiro(
  roteiro: Roteiro,
  estado: RoteiroEstado,
): { instrucao: string; menu?: string[] } | null {
  const atual = passoAtual(roteiro, estado)
  if (!atual) {
    return roteiro.resumoFinal
      ? { instrucao: 'O roteiro chegou ao fim. Apresente um RESUMO dos dados coletados e peça a confirmação do cliente; ao confirmar, conclua.' }
      : null
  }
  const abertura =
    !estado.ramo && estado.idx === 0 && roteiro.aberturaFixa
      ? `Abra a conversa com esta abordagem: "${roteiro.aberturaFixa}". `
      : ''
  if (atual.passo.tipo === 'menu') {
    const rotulos = atual.passo.opcoes.map((o) => o.rotulo)
    return {
      instrucao: `${abertura}Pergunte: "${atual.passo.texto}" e apresente as opções: ${rotulos.join(' / ')}. Quando o cliente escolher, coloque em "opcao_roteiro" EXATAMENTE um destes: ${rotulos.join(' / ')}.`,
      menu: rotulos,
    }
  }
  const captura = atual.passo.campo
    ? ` Guarde a resposta do cliente em fatos_novos["${atual.passo.campo}"].`
    : ''
  const prox = proximaPergunta(roteiro, estado)
  const depois = prox
    ? ` Se o cliente ACABOU de responder isto, agradeça em uma frase curta e JÁ emende a próxima pergunta, tudo na mesma mensagem: "${prox}".`
    : ' Se o cliente ACABOU de responder isto, agradeça brevemente e siga para a próxima etapa.'
  return { instrucao: `${abertura}Sua tarefa AGORA é obter esta resposta — pergunte: "${atual.passo.texto}".${captura}${depois}` }
}
