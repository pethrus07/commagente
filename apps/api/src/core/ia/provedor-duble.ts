// 🔌 Provedor de IA DUBLÊ (offline, determinístico).
// Permite construir e testar o harness inteiro sem LLM real (sem key, sem custo).
// Troca-se pelo provedor OpenAI só adicionando o adapter — a porta é a mesma.
import type { ContextoIA, ProvedorIA, SaidaIA } from './porta-ia'

function ultimaEntrada(ctx: ContextoIA): string {
  return (
    [...ctx.ultimasMensagens].reverse().find((m) => m.direcao === 'in')
      ?.conteudo ?? ''
  ).toLowerCase()
}

export const provedorDuble: ProvedorIA = {
  nome: 'duble',

  async gerar(ctx: ContextoIA): Promise<{ saida: SaidaIA }> {
    const ultima = ultimaEntrada(ctx)

    // "não/parar" → descarta educadamente
    if (/\b(n[ãa]o|para|parar|sair|cancelar)\b/.test(ultima)) {
      return {
        saida: {
          resposta:
            'Sem problemas, obrigado pelo retorno! Qualquer coisa, estou por aqui. 🙂',
          novo_estado: 'descartada',
          categoria: 'sem_fit',
          fatos_novos: {},
          precisa_humano: false,
        },
      }
    }

    const interessado = /\b(sim|quero|tenho interesse|pode|bora|vamos)\b/.test(
      ultima,
    )
    return {
      saida: {
        resposta: `Perfeito! Sobre "${ctx.objetivo}", me conta rapidinho: qual é o seu principal desafio hoje?`,
        novo_estado: 'em_conversa',
        categoria: interessado ? 'interessado' : 'em_andamento',
        fatos_novos: {},
        precisa_humano: false,
      },
    }
  },

  async resumir(ctx): Promise<{ texto: string }> {
    const ins = ctx.ultimasMensagens.filter((m) => m.direcao === 'in').length
    const outs = ctx.ultimasMensagens.filter((m) => m.direcao === 'out').length
    const ultimaIn =
      [...ctx.ultimasMensagens].reverse().find((m) => m.direcao === 'in')
        ?.conteudo ?? '—'
    const fatos =
      ctx.fatos && Object.keys(ctx.fatos).length > 0
        ? JSON.stringify(ctx.fatos)
        : 'nenhum'
    return {
      texto: `Objetivo: ${ctx.objetivo}. Trocas recentes: ${ins} do lead / ${outs} nossas. Última do lead: "${ultimaIn}". Fatos: ${fatos}.`,
    }
  },
}
