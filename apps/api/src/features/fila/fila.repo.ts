// 🔌 Infraestrutura — a fila de envio (tabela fila_envio) e os contadores do número.
import type { Prisma, StatusEnvio } from '@prisma/client'
import { db } from '../../core/db'

export const filaRepo = {
  enfileirar(p: {
    tenantId: string
    missaoId: string
    contatoId: string
    payload: Prisma.InputJsonValue
    agendadoPara: Date
  }) {
    return db.filaEnvio.create({
      data: {
        tenantId: p.tenantId,
        missaoId: p.missaoId,
        contatoId: p.contatoId,
        payload: p.payload,
        agendadoPara: p.agendadoPara,
      },
    })
  },

  // itens pendentes já "vencidos" (agendado_para <= agora)
  pegarDevidos(agora: Date, limite = 3) {
    return db.filaEnvio.findMany({
      where: { status: 'pendente', agendadoPara: { lte: agora } },
      orderBy: { agendadoPara: 'asc' },
      take: limite,
    })
  },

  marcar(id: string, status: StatusEnvio, incTentativa = false) {
    return db.filaEnvio.update({
      where: { id },
      data: { status, ...(incTentativa ? { tentativas: { increment: 1 } } : {}) },
    })
  },

  buscarNumero(id: string) {
    return db.numeroWhatsapp.findUnique({ where: { id } })
  },

  incrementarEnviados(numeroId: string) {
    return db.numeroWhatsapp.update({
      where: { id: numeroId },
      data: { enviadosHoje: { increment: 1 } },
    })
  },

  // vira o dia → zera o contador e carimba a nova data-ref
  resetarContador(numeroId: string, data: string) {
    return db.numeroWhatsapp.update({
      where: { id: numeroId },
      data: { enviadosHoje: 0, enviadosData: data },
    })
  },
}
