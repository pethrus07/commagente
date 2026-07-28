// ⚙️ Aplicação — métricas agregadas para o dashboard do painel.
import { config } from '../../core/config'
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { classificarSaude } from '../numeros/numeros.dominio'
import { numerosRepo } from '../numeros/numeros.repo'

// VIGIA (enxuto, sem canal externo): calcula na leitura os alertas operacionais que o
// dashboard mostra — número em risco de bloqueio e número parado (silêncio). É o "vigia
// por tenant" da reunião, sem depender de e-mail/push.
// CACHE (perf): o dashboard faz poll a cada 8s e o vigia roda ~3 queries/número sobre as
// tabelas grandes (missoes/mensagens). Cacheamos por tenant com TTL curto — os alertas
// mudam devagar, então servir do cache por 1min corta a maior parte da carga.
const vigiaCache = new Map<string, { at: number; alertas: { tipo: string; mensagem: string }[] }>()
const VIGIA_TTL_MS = 60_000

async function vigia(tenantId: string): Promise<{ tipo: string; mensagem: string }[]> {
  const agora = Date.now()
  const cache = vigiaCache.get(tenantId)
  if (cache && agora - cache.at < VIGIA_TTL_MS) return cache.alertas

  const numeros = await db.numeroWhatsapp.findMany({
    where: { tenantId },
    select: { id: true, telefone: true, statusConexao: true, criadoEm: true },
  })
  const h24 = new Date(Date.now() - 24 * 3_600_000)
  const alertas: { tipo: string; mensagem: string }[] = []
  for (const n of numeros) {
    // CHIP CAÍDO (backstop do reconciliador): número que opera (tem missões) mas está
    // desconectado → nada entra nem sai. Alerta forte no dashboard.
    if (n.statusConexao !== 'conectado') {
      const temMissoes = await db.missao.count({ where: { numeroId: n.id } })
      if (temMissoes > 0) {
        alertas.push({
          tipo: 'chip_caido',
          mensagem: `Número +${n.telefone} DESCONECTADO — reconecte o WhatsApp (Números → QR). Nada entra nem sai enquanto isso.`,
        })
      }
      continue // desconectado → não faz sentido checar saúde/silêncio
    }
    // saúde: taxa de resposta baixa → risco de bloqueio (iniciações já ficam pausadas)
    const { base, naoRespondidas } = await numerosRepo.saude(n.id)
    const s = classificarSaude(base, naoRespondidas)
    if (s.status === 'risco') {
      alertas.push({
        tipo: 'saude',
        mensagem: `Número +${n.telefone} com taxa de resposta baixa (${Math.round((s.replyRate ?? 0) * 100)}%) — novas iniciações pausadas p/ evitar bloqueio.`,
      })
    }
    // silêncio: conectado, criado há +24h, sem NENHUMA saída nas últimas 24h.
    // Só alerta número OPERADO pela IA (tem missões) — evita falso "silêncio" num número
    // usado só p/ envios manuais/avisos, que legitimamente não abre conversas.
    if (n.statusConexao === 'conectado' && n.criadoEm < h24) {
      const [saidas, temMissoes] = await Promise.all([
        db.mensagem.count({
          where: { tenantId, direcao: 'out', criadaEm: { gte: h24 }, missao: { numeroId: n.id } },
        }),
        db.missao.count({ where: { numeroId: n.id } }),
      ])
      if (saidas === 0 && temMissoes > 0) {
        alertas.push({
          tipo: 'silencio',
          mensagem: `Número +${n.telefone} conectado, mas sem nenhuma mensagem enviada nas últimas 24h.`,
        })
      }
    }
  }
  vigiaCache.set(tenantId, { at: agora, alertas })
  return alertas
}

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
    alertas: await vigia(tenantId),
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
