// Espelho (frontend) das categorias do DNA — mantém em sincronia com apps/api/.../tenant.dna.ts.
// O DNA é o conhecimento da empresa por categorias; defaults-first (preencha só o que importa).
export const CHAVES_DNA = [
  'empresa',
  'produtos',
  'precos',
  'publicoAlvo',
  'diferenciais',
  'processoComercial',
  'faq',
  'glossario',
  'casosSucesso',
  'regrasNegocio',
] as const
export type ChaveDna = (typeof CHAVES_DNA)[number]
export type Dna = Partial<Record<ChaveDna, string | null>>

export interface CategoriaDna {
  chave: ChaveDna
  titulo: string
  dica: string
  prioridade?: boolean // Regras de Negócio: prioridade máxima no prompt
}

export const CATEGORIAS_DNA: CategoriaDna[] = [
  { chave: 'empresa', titulo: 'A empresa', dica: 'Quem é, o que faz, história e missão — em poucas linhas.' },
  { chave: 'produtos', titulo: 'Produtos e serviços', dica: 'O que você vende/oferece. Os principais, não o catálogo inteiro.' },
  { chave: 'precos', titulo: 'Preços e condições', dica: 'Valores, formas de pagamento, prazos. A IA só afirma preço que estiver aqui.' },
  { chave: 'publicoAlvo', titulo: 'Público-alvo', dica: 'Cliente ideal, dores e o que ele valoriza.' },
  { chave: 'diferenciais', titulo: 'Diferenciais', dica: 'Por que escolher você, e não o concorrente.' },
  { chave: 'processoComercial', titulo: 'Processo comercial', dica: 'Como você vende: etapas, abordagem, o que perguntar antes de fechar.' },
  { chave: 'faq', titulo: 'Perguntas e objeções', dica: 'Dúvidas comuns e como respondê-las / contornar objeções.' },
  { chave: 'glossario', titulo: 'Glossário', dica: 'Termos e jargões do seu negócio que a IA precisa entender.' },
  { chave: 'casosSucesso', titulo: 'Casos de sucesso', dica: 'Histórias e argumentos que costumam funcionar.' },
  {
    chave: 'regrasNegocio',
    titulo: 'Regras de negócio',
    dica: 'Limites invioláveis: o que a IA NUNCA pode fazer ou prometer. Prioridade máxima.',
    prioridade: true,
  },
]
