/**
 * ESPELHO (frontend) do estilo de conversa da API (features/tenant/tenant.estilo.ts): o padrão
 * da casa e os PERFIS por papel (Vendedor, Suporte, Cobrança…) que vêm embutidos nos modelos de
 * missão. Não é gerado — mexeu no domínio da API, mexa aqui também.
 */
import type { EstiloConversa } from './types'

// Estilo padrão (espelha o ESTILO_PADRAO da API): mata o travessão de cara (ganho universal),
// resto conservador. É o fallback do tenant quando uma missão não define perfil próprio.
export const ESTILO_PADRAO: EstiloConversa = {
  perfil: null,
  formalidade: 'equilibrado',
  emoji: false,
  abreviacoes: false,
  travessaoProibido: true,
  bolhas: false,
}

// PERFIS por papel — o "jeito de falar" que vem embutido em cada modelo de missão.
// O usuário escolhe o modelo, o perfil vem junto e ele ajusta → personalizado (salvo na missão).
export const PERFIS: Record<string, EstiloConversa> = {
  vendedor: { perfil: 'Vendedor', formalidade: 'informal', emoji: true, abreviacoes: true, travessaoProibido: true, bolhas: true },
  vendedorConsultivo: { perfil: 'Vendedor consultivo', formalidade: 'informal', emoji: false, abreviacoes: true, travessaoProibido: true, bolhas: true },
  qualificacao: { perfil: 'Qualificação', formalidade: 'equilibrado', emoji: false, abreviacoes: true, travessaoProibido: true, bolhas: false },
  orcamento: { perfil: 'Orçamento', formalidade: 'equilibrado', emoji: false, abreviacoes: false, travessaoProibido: true, bolhas: false },
  cobranca: { perfil: 'Cobrança', formalidade: 'equilibrado', emoji: false, abreviacoes: false, travessaoProibido: true, bolhas: false },
  suporte: { perfil: 'Suporte', formalidade: 'equilibrado', emoji: false, abreviacoes: false, travessaoProibido: true, bolhas: false },
  descolado: { perfil: 'Descolado', formalidade: 'informal', emoji: true, abreviacoes: true, travessaoProibido: true, bolhas: true },
  padrao: { perfil: 'Padrão da casa', ...{ formalidade: 'equilibrado', emoji: false, abreviacoes: false, travessaoProibido: true, bolhas: false } },
}
