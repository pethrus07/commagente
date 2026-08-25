// Espelho (frontend) do MODO ROTEIRO — mantém em sincronia com apps/api/.../roteiro/roteiro.dominio.ts.
// Roteiro = sequência guiada que a campanha segue. v1: passos lineares + menu de 1 nível.

export type PassoPergunta = { tipo: 'pergunta'; texto: string; campo?: string }
export type OpcaoMenu = { rotulo: string; passos: PassoPergunta[] }
export type PassoMenu = { tipo: 'menu'; texto: string; opcoes: OpcaoMenu[] }
export type Passo = PassoPergunta | PassoMenu

export type Roteiro = {
  aberturaFixa?: string
  resumoFinal?: boolean
  passos: Passo[]
}

// fábricas (novos itens em branco)
export const novaPergunta = (): PassoPergunta => ({ tipo: 'pergunta', texto: '', campo: '' })
export const novoMenu = (): PassoMenu => ({
  tipo: 'menu',
  texto: '',
  opcoes: [
    { rotulo: '', passos: [novaPergunta()] },
    { rotulo: '', passos: [novaPergunta()] },
  ],
})

// tira campos em branco; devolve null se não sobra passo nenhum (= conversa livre → limpa a coluna)
export function limparRoteiro(r: Roteiro | null | undefined): Roteiro | null {
  if (!r) return null
  const passos = r.passos.map(limparPasso).filter((p): p is Passo => !!p)
  if (passos.length === 0) return null
  return {
    passos,
    ...(r.aberturaFixa?.trim() ? { aberturaFixa: r.aberturaFixa.trim() } : {}),
    ...(r.resumoFinal ? { resumoFinal: true } : {}),
  }
}

function limparPergunta(p: PassoPergunta): PassoPergunta | null {
  const texto = p.texto?.trim()
  if (!texto) return null
  const campo = p.campo?.trim()
  return { tipo: 'pergunta', texto, ...(campo ? { campo } : {}) }
}

function limparPasso(p: Passo): Passo | null {
  if (p.tipo === 'menu') {
    const texto = p.texto?.trim()
    const opcoes = p.opcoes
      .map((o) => ({ rotulo: o.rotulo?.trim() ?? '', passos: o.passos.map(limparPergunta).filter((x): x is PassoPergunta => !!x) }))
      .filter((o) => o.rotulo)
    return texto && opcoes.length > 0 ? { tipo: 'menu', texto, opcoes } : null
  }
  return limparPergunta(p)
}

// conta os passos "reais" (perguntas + menus + passos dentro dos ramos) — pro selo do cabeçalho
export function contarPassos(r: Roteiro | null | undefined): number {
  const limpo = limparRoteiro(r)
  if (!limpo) return 0
  return limpo.passos.reduce((n, p) => n + 1 + (p.tipo === 'menu' ? p.opcoes.reduce((m, o) => m + o.passos.length, 0) : 0), 0)
}

// ── Modelos prontos (o atalho lúdico: clica e já tem um roteiro decente pra ajustar) ──
export interface ModeloRoteiro {
  id: string
  emoji: string
  nome: string
  descricao: string
  roteiro: Roteiro
}

export const MODELOS_ROTEIRO: ModeloRoteiro[] = [
  {
    id: 'cadastro',
    emoji: '📝',
    nome: 'Cadastro rápido',
    descricao: 'Pega nome, atividade e o que a pessoa procura. Direto ao ponto.',
    roteiro: {
      resumoFinal: true,
      passos: [
        { tipo: 'pergunta', texto: 'Como posso te chamar?', campo: 'nome' },
        { tipo: 'pergunta', texto: 'Com o que você trabalha hoje?', campo: 'atividade' },
        { tipo: 'pergunta', texto: 'O que você está buscando por aqui?', campo: 'necessidade' },
      ],
    },
  },
  {
    id: 'empresa-ou-profissional',
    emoji: '🔀',
    nome: 'Empresa ou profissional',
    descricao: 'Pergunta o perfil e segue um caminho diferente pra cada um.',
    roteiro: {
      resumoFinal: true,
      passos: [
        { tipo: 'pergunta', texto: 'Antes de começar, como posso te chamar?', campo: 'nome' },
        {
          tipo: 'menu',
          texto: 'Você está por aqui como empresa ou como profissional?',
          opcoes: [
            {
              rotulo: 'Empresa',
              passos: [
                { tipo: 'pergunta', texto: 'Qual o nome da empresa e o ramo dela?', campo: 'empresa' },
                { tipo: 'pergunta', texto: 'Que tipo de profissional ou serviço você precisa?', campo: 'necessidade' },
              ],
            },
            {
              rotulo: 'Profissional',
              passos: [
                { tipo: 'pergunta', texto: 'Qual é a sua especialidade?', campo: 'especialidade' },
                { tipo: 'pergunta', texto: 'Que tipo de oportunidade você procura?', campo: 'objetivo' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'zero',
    emoji: '✨',
    nome: 'Começar do zero',
    descricao: 'Um roteiro em branco pra você montar do seu jeito.',
    roteiro: { passos: [novaPergunta()] },
  },
]
