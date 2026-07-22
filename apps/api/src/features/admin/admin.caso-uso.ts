// ⚙️ Aplicação — administração da plataforma (só super-admin).
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { senha as senhaUtil } from '../../core/senha'

export async function listarTenants() {
  const tenants = await db.tenant.findMany({
    orderBy: { criadoEm: 'desc' },
    include: {
      _count: { select: { missoes: true, numeros: true, contatos: true, usuarios: true } },
    },
  })
  return tenants.map((t) => ({
    id: t.id,
    nome: t.nome,
    criadoEm: t.criadoEm,
    totalMissoes: t._count.missoes,
    totalNumeros: t._count.numeros,
    totalContatos: t._count.contatos,
    totalUsuarios: t._count.usuarios,
  }))
}

// cria um tenant (cliente) + o usuário admin dele
export async function criarTenant(input: {
  nome: string
  adminEmail: string
  adminSenha: string
}) {
  const email = input.adminEmail.toLowerCase()
  const jaExiste = await db.usuario.findUnique({ where: { email } })
  if (jaExiste) throw new ErroHttp(409, 'Já existe um usuário com esse e-mail')

  const tenant = await db.tenant.create({ data: { nome: input.nome } })
  await db.usuario.create({
    data: {
      tenantId: tenant.id,
      email,
      senhaHash: await senhaUtil.hash(input.adminSenha),
      papel: 'admin_tenant',
    },
  })
  return { id: tenant.id, nome: tenant.nome, adminEmail: email }
}
