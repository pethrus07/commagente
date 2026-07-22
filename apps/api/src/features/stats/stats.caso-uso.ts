// ⚙️ Aplicação — métricas agregadas para o dashboard do painel.
import { config } from '../../core/config'
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'

export async function obterStats() {
  const tenantId = await tenantAtual()
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  const [grupos, gruposTipo, totalNumeros, conectados, mensagensHoje, totalContatos] =
    await Promise.all([
      db.missao.groupBy({
        by: ['estado'],
        where: { tenantId },
        _count: { _all: true },
      }),
      db.missao.groupBy({
        by: ['tipo'],
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

  const missoesPorTipo: Record<string, number> = {}
  for (const g of gruposTipo) missoesPorTipo[g.tipo] = g._count._all

  // placar por missão (o "resultado" do agente)
  const cumpridas = missoesPorEstado.concluida ?? 0
  const perdidas = (missoesPorEstado.descartada ?? 0) + (missoesPorEstado.sem_resposta ?? 0)
  const ativas =
    (missoesPorEstado.na_fila ?? 0) +
    (missoesPorEstado.em_conversa ?? 0) +
    (missoesPorEstado.escalada ?? 0)
  const fechadas = cumpridas + perdidas
  const placar = {
    cumpridas,
    perdidas,
    ativas,
    taxaConclusao: fechadas > 0 ? cumpridas / fechadas : null,
  }

  return {
    missoesPorEstado,
    missoesPorTipo,
    placar,
    totalMissoes,
    totalContatos,
    numeros: { total: totalNumeros, conectados },
    mensagensHoje,
  }
}

// dia "YYYY-MM-DD" no fuso configurado
function diaKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// Histórico: séries por dia (últimos N dias) para os gráficos do dashboard.
export async function obterHistorico(dias = 14) {
  const tenantId = await tenantAtual()
  const inicio = new Date(Date.now() - dias * 86_400_000)

  const [missoes, mensagens, eventos, concluidas] = await Promise.all([
    db.missao.findMany({
      where: { tenantId, criadoEm: { gte: inicio } },
      select: { criadoEm: true },
    }),
    db.mensagem.findMany({
      where: { tenantId, criadaEm: { gte: inicio } },
      select: { criadaEm: true },
    }),
    db.evento.findMany({
      where: { tenantId, criadoEm: { gte: inicio }, tipo: { in: ['escalada', 'turno_ia'] } },
      select: { criadoEm: true, tipo: true },
    }),
    db.missao.findMany({
      where: { tenantId, concluidaEm: { gte: inicio } },
      select: { concluidaEm: true },
    }),
  ])

  // esqueleto dos últimos N dias (em ordem)
  const base = new Map<
    string,
    { data: string; missoes: number; mensagens: number; turnos: number; escaladas: number; concluidas: number }
  >()
  for (let i = dias - 1; i >= 0; i--) {
    const k = diaKey(new Date(Date.now() - i * 86_400_000))
    base.set(k, { data: k, missoes: 0, mensagens: 0, turnos: 0, escaladas: 0, concluidas: 0 })
  }
  const bump = (k: string, campo: 'missoes' | 'mensagens' | 'turnos' | 'escaladas' | 'concluidas') => {
    const dia = base.get(k)
    if (dia) dia[campo]++
  }

  for (const m of missoes) bump(diaKey(m.criadoEm), 'missoes')
  for (const m of mensagens) bump(diaKey(m.criadaEm), 'mensagens')
  for (const e of eventos) bump(diaKey(e.criadoEm), e.tipo === 'escalada' ? 'escaladas' : 'turnos')
  for (const c of concluidas) if (c.concluidaEm) bump(diaKey(c.concluidaEm), 'concluidas')

  return { dias: [...base.values()] }
}
