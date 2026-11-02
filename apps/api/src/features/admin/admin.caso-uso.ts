// ⚙️ Aplicação — administração da plataforma (só super-admin).
import { custoBrl, TETO_CUSTO_BRL } from '../../core/custo.js'
import { db } from '../../core/db.js'
import { ErroHttp } from '../../core/erros.js'
import { senha as senhaUtil } from '../../core/senha.js'

export async function listarTenants() {
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)
  const [tenants, custos, msgsHoje, ativas, conectados, ultimaMsg] = await Promise.all([
    db.tenant.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { missoes: true, numeros: true, contatos: true, usuarios: true } },
      },
    }),
    // custo de IA acumulado por tenant (protege a key da OpenAI — só super-admin vê)
    db.missao.groupBy({ by: ['tenantId'], _sum: { tokensEntrada: true, tokensSaida: true } }),
    // ── monitoramento ao vivo (§8.10): atividade de HOJE + estado atual por tenant ──
    db.mensagem.groupBy({ by: ['tenantId'], where: { criadaEm: { gte: inicioHoje } }, _count: true }),
    db.missao.groupBy({ by: ['tenantId'], where: { estado: { in: ['em_conversa', 'na_fila'] } }, _count: true }),
    db.numeroWhatsapp.groupBy({ by: ['tenantId'], where: { statusConexao: 'conectado' }, _count: true }),
    db.mensagem.groupBy({ by: ['tenantId'], _max: { criadaEm: true } }),
  ])
  const mapaCusto = new Map(
    custos.map((c) => [c.tenantId, custoBrl(c._sum.tokensEntrada ?? 0, c._sum.tokensSaida ?? 0)]),
  )
  const mapMsgHoje = new Map(msgsHoje.map((m) => [m.tenantId, m._count]))
  const mapAtivas = new Map(ativas.map((m) => [m.tenantId, m._count]))
  const mapConectados = new Map(conectados.map((n) => [n.tenantId, n._count]))
  const mapUltima = new Map(ultimaMsg.map((m) => [m.tenantId, m._max.criadaEm]))
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
      // ao vivo
      mensagensHoje: (mapMsgHoje.get(t.id) as number) ?? 0,
      missoesAtivas: (mapAtivas.get(t.id) as number) ?? 0,
      numerosConectados: (mapConectados.get(t.id) as number) ?? 0,
      ultimaAtividade: mapUltima.get(t.id) ?? null,
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
