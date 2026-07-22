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

  // atualiza o resumo rolante da missão
  salvarResumo(id: string, resumo: string) {
    return db.missao.update({ where: { id }, data: { resumo } })
  },

  // memória INDIVIDUAL: mescla fatos novos no perfil do contato (persiste entre missões)
  async mesclarMemoriaContato(
    contatoId: string,
    novos: Record<string, unknown>,
  ) {
    const contato = await db.contato.findUnique({
      where: { id: contatoId },
      select: { memoria: true },
    })
    const atual = (contato?.memoria as Record<string, unknown> | null) ?? {}
    return db.contato.update({
      where: { id: contatoId },
      data: { memoria: { ...atual, ...novos } as Prisma.InputJsonValue },
    })
  },
}
