// ⚙️ Aplicação — leitura de contatos (o "C" do CRM) com contagem de missões.
import { tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'

export async function listarContatos() {
  const tenantId = await tenantAtual()
  const contatos = await db.contato.findMany({
    where: { tenantId },
    orderBy: { criadoEm: 'desc' },
    include: { _count: { select: { missoes: true } } },
  })
  return contatos.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    origem: c.origem,
    criadoEm: c.criadoEm,
    totalMissoes: c._count.missoes,
  }))
}
