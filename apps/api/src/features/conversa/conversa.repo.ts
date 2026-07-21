// 🔌 Infraestrutura — persistência específica do harness da conversa.
import type { Prisma } from '@prisma/client'
import { db } from '../../core/db'

export const conversaRepo = {
  // mescla/atualiza os fatos (memória) da missão
  salvarFatos(id: string, fatos: Record<string, unknown>) {
    return db.missao.update({
      where: { id },
      data: { fatos: fatos as Prisma.InputJsonValue },
    })
  },
}
