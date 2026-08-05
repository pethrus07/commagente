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

// ── DNA hierárquico (#9): camada que sobrescreve o DNA-base por categoria ──
// Herdar = categoria ausente. Substituir = troca o texto. Combinar = soma ao herdado.
export type ModoDna = 'substituir' | 'combinar'
export type CamadaDna = Partial<Record<ChaveDna, { modo: ModoDna; texto: string }>>

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

// ── DNA do CONTATO (Item 5) — conhecimento sobre a PESSOA (personalização, não fato) ──
export const CHAVES_DNA_CONTATO = ['perfil', 'comunicacao', 'historico', 'observacoes'] as const
export type ChaveDnaContato = (typeof CHAVES_DNA_CONTATO)[number]
export type DnaContato = Partial<Record<ChaveDnaContato, string | null>>

export const CATEGORIAS_DNA_CONTATO: { chave: ChaveDnaContato; titulo: string; dica: string }[] = [
  { chave: 'perfil', titulo: 'Perfil', dica: 'Quem é: cargo, empresa, papel na decisão, contexto.' },
  { chave: 'comunicacao', titulo: 'Comunicação', dica: 'Como falar com ele: prefere formal ou direto? o que evitar?' },
  { chave: 'historico', titulo: 'Histórico', dica: 'Relacionamento até aqui: compras, promessas, conversas passadas.' },
  { chave: 'observacoes', titulo: 'Observações', dica: 'Notas livres — qualquer coisa útil pra personalizar o atendimento.' },
]
