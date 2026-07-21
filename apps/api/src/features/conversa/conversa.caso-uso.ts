// ⚙️ Aplicação — o HARNESS da conversa (a moldura determinística em volta do LLM).
// 1 turno: monta contexto → IA (structured) → valida → aplica estado + fatos → responde.
import { db } from '../../core/db'
import { ia } from '../../core/ia'
import { type ContextoIA, SaidaIASchema } from '../../core/ia/porta-ia'
import { enviarTexto } from '../envio/envio.caso-uso'
import { podeTransicionar } from '../missoes/missao.dominio'
import { missoesRepo } from '../missoes/missoes.repo'
import { conversaRepo } from './conversa.repo'

const ULTIMAS = 8 // qtde de mensagens no contexto (Fatia 5 refina memória/resumo)

export async function processarTurno(missaoId: string) {
  const missao = await missoesRepo.buscar(missaoId)
  if (!missao) return { ok: false as const, motivo: 'missao_inexistente' }

  // 1) monta a ficha (contexto) — versão mínima
  const ctx: ContextoIA = {
    objetivo: missao.objetivo,
    contexto: missao.contexto,
    estadoAtual: missao.estado,
    fatos: (missao.fatos as Record<string, unknown> | null) ?? {},
    ultimasMensagens: missao.mensagens
      .slice(-ULTIMAS)
      .map((m) => ({ direcao: m.direcao, conteudo: m.conteudo })),
  }

  // 2) chama a IA e 3) VALIDA o contrato (guardrail — nunca confia cego no modelo)
  const saida = SaidaIASchema.parse(await ia.gerar(ctx))

  // 4) memória: mescla fatos novos
  if (saida.fatos_novos && Object.keys(saida.fatos_novos).length > 0) {
    await conversaRepo.salvarFatos(missaoId, {
      ...(ctx.fatos ?? {}),
      ...saida.fatos_novos,
    })
  }

  // 5) guardrail: precisa de humano → escala e NÃO responde automático
  if (saida.precisa_humano) {
    if (podeTransicionar(missao.estado, 'escalada')) {
      await missoesRepo.atualizarEstado(missaoId, 'escalada')
    }
    await db.evento.create({
      data: {
        tenantId: missao.tenantId,
        missaoId,
        tipo: 'escalada',
        dados: { motivo: saida.motivo_escala ?? null },
      },
    })
    return { ok: true as const, escalada: true }
  }

  // 6) aplica o novo estado (se a transição for válida)
  if (
    saida.novo_estado !== missao.estado &&
    podeTransicionar(missao.estado, saida.novo_estado)
  ) {
    await missoesRepo.atualizarEstado(
      missaoId,
      saida.novo_estado,
      saida.novo_estado === 'concluida' ? { concluidaEm: new Date() } : undefined,
    )
  }

  // 7) responde (o executor grava a Mensagem[out] ligada à missão)
  const envio = await enviarTexto(
    missao.numeroId,
    missao.contato.telefone,
    saida.resposta,
    missaoId,
  )
  await db.evento.create({
    data: {
      tenantId: missao.tenantId,
      missaoId,
      tipo: 'turno_ia',
      dados: {
        provedor: ia.nome,
        categoria: saida.categoria ?? null,
        novo_estado: saida.novo_estado,
      },
    },
  })
  return {
    ok: true as const,
    resposta: saida.resposta,
    novo_estado: saida.novo_estado,
    providerMsgId: envio.providerMsgId,
  }
}
