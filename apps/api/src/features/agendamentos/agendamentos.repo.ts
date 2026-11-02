// 🔌 Infraestrutura — persistência dos agendamentos (Prisma).
import type { Prisma } from '@prisma/client'
import { db } from '../../core/db.js'

export const agendamentosRepo = {
  listar(tenantId: string) {
    return db.agendamento.findMany({
      where: { tenantId },
      include: {
        contato: { select: { nome: true, telefone: true, optOut: true } },
        numero: { select: { telefone: true } },
      },
      orderBy: { criadoEm: 'desc' },
    })
  },

  buscar(id: string) {
    return db.agendamento.findUnique({ where: { id }, include: { contato: true } })
  },

  criar(data: Prisma.AgendamentoUncheckedCreateInput) {
    return db.agendamento.create({ data })
  },

  // TODOS os tenants ativos — usado pelo agendador (sem contexto de request).
  ativos() {
    return db.agendamento.findMany({ where: { ativo: true }, include: { contato: true } })
  },

  atualizar(id: string, data: Prisma.AgendamentoUncheckedUpdateInput) {
    return db.agendamento.update({ where: { id }, data })
  },

  marcarDisparado(id: string, cicloRef: string, quando: Date) {
    return db.agendamento.update({
      where: { id },
      data: { ultimoCicloRef: cicloRef, ultimoDisparoEm: quando, execucoes: { increment: 1 } },
    })
  },

  desativar(id: string) {
    return db.agendamento.update({ where: { id }, data: { ativo: false } })
  },

  remover(id: string) {
    return db.agendamento.delete({ where: { id } })
  },
}
