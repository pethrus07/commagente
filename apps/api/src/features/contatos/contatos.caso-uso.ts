// ⚙️ Aplicação — leitura de contatos (o "C" do CRM) com contagem de missões.
import { db } from '../../core/db'
import { garantirTenantPadrao } from '../../core/tenant'

export async function listarContatos() {
  const tenantId = await garantirTenantPadrao()
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
