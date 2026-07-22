// ⚙️ Aplicação — métricas agregadas para o dashboard do painel.
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'

export async function obterStats() {
  const tenantId = await tenantAtual()
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  const [grupos, totalNumeros, conectados, mensagensHoje, totalContatos] =
    await Promise.all([
      db.missao.groupBy({
        by: ['estado'],
        where: { tenantId },
        _count: { _all: true },
      }),
      db.numeroWhatsapp.count({ where: { tenantId } }),
      db.numeroWhatsapp.count({
        where: { tenantId, statusConexao: 'conectado' },
      }),
      db.mensagem.count({
        where: { tenantId, criadaEm: { gte: inicioHoje } },
      }),
      db.contato.count({ where: { tenantId } }),
    ])

  const missoesPorEstado: Record<string, number> = {}
  let totalMissoes = 0
  for (const g of grupos) {
    missoesPorEstado[g.estado] = g._count._all
    totalMissoes += g._count._all
  }

  return {
    missoesPorEstado,
    totalMissoes,
    totalContatos,
    numeros: { total: totalNumeros, conectados },
    mensagensHoje,
  }
}
