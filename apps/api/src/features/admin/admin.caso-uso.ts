// ⚙️ Aplicação — administração da plataforma (só super-admin).
import { custoBrl, TETO_CUSTO_BRL } from '../../core/custo'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { senha as senhaUtil } from '../../core/senha'

export async function listarTenants() {
  const [tenants, custos] = await Promise.all([
    db.tenant.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { missoes: true, numeros: true, contatos: true, usuarios: true } },
      },
    }),
    // custo de IA acumulado por tenant (protege a key da OpenAI — só super-admin vê)
    db.missao.groupBy({ by: ['tenantId'], _sum: { tokensEntrada: true, tokensSaida: true } }),
  ])
  const mapaCusto = new Map(
    custos.map((c) => [c.tenantId, custoBrl(c._sum.tokensEntrada ?? 0, c._sum.tokensSaida ?? 0)]),
  )
  return tenants.map((t) => {
    const custo = mapaCusto.get(t.id) ?? 0
    return {
      id: t.id,
      nome: t.nome,
      criadoEm: t.criadoEm,
      totalMissoes: t._count.missoes,
      totalNumeros: t._count.numeros,
      totalContatos: t._count.contatos,
      totalUsuarios: t._count.usuarios,
      custoBrl: custo,
      custoAlto: custo >= TETO_CUSTO_BRL, // acima do teto → alerta
    }
  })
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
