// 🔌 Infraestrutura — persistência do NumeroWhatsapp (Prisma).
import type { StatusConexao } from '@prisma/client'
import { db } from '../../core/db.js'

export const numerosRepo = {
  criar(tenantId: string, telefone: string, instanciaEvolution: string, apelido?: string | null) {
    return db.numeroWhatsapp.create({
      data: { tenantId, telefone, instanciaEvolution, apelido: apelido || null },
    })
  },

  buscar(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  listar(tenantId: string) {
    return db.numeroWhatsapp.findMany({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' },
    })
  },

  atualizarStatus(id: string, statusConexao: StatusConexao) {
    return db.numeroWhatsapp.update({
      where: { id },
      data: { statusConexao },
    })
  },

  atualizarConfig(
    id: string,
    data: {
      apelido?: string | null
      janelaInicio?: string
      janelaFim?: string
      budgetDiario?: number
      maxConversasAtivas?: number
      suporteReativo?: boolean
      suporteObjetivo?: string | null
      suporteTom?: string | null
      suporteInformacoes?: string | null
      suporteCriterio?: string | null
      suporteModo?: string
      avisarEscalonamento?: boolean
      numeroAviso?: string | null
    },
  ) {
    return db.numeroWhatsapp.update({ where: { id }, data })
  },

  // remove o número do sistema (só quando não tem vínculos — checado no caso-uso)
  deletar(id: string) {
    return db.numeroWhatsapp.delete({ where: { id } })
  },

  // vínculos que impedem a remoção segura (o número é FK obrigatória em missão/campanha)
  async contarVinculos(numeroId: string): Promise<{ missoes: number; campanhas: number }> {
    const [missoes, campanhas] = await Promise.all([
      db.missao.count({ where: { numeroId } }),
      db.campanha.count({ where: { numeroId } }),
    ])
    return { missoes, campanhas }
  },

  // quantas conversas o número tem ativas sob a IA (na fila + em conversa)
  contarAtivas(numeroId: string) {
    return db.missao.count({
      where: { numeroId, estado: { in: ['na_fila', 'em_conversa'] } },
    })
  },

  // saúde anti-ban: base = missões iniciadas há +48h nos últimos 30d (tiveram
  // tempo de responder); naoRespondidas = ainda em na_fila/sem_resposta.
  async saude(numeroId: string): Promise<{ base: number; naoRespondidas: number }> {
    const desde = new Date(Date.now() - 30 * 86_400_000)
    const ate = new Date(Date.now() - 48 * 3_600_000)
    const [base, naoRespondidas] = await Promise.all([
      db.missao.count({
        where: { numeroId, criadoEm: { gte: desde, lt: ate }, estado: { not: 'configurada' } },
      }),
      db.missao.count({
        where: {
          numeroId,
          criadoEm: { gte: desde, lt: ate },
          estado: { in: ['na_fila', 'sem_resposta'] },
        },
      }),
    ])
    return { base, naoRespondidas }
  },
}
