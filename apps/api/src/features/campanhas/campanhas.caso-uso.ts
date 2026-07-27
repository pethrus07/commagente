// ⚙️ Aplicação — campanhas: a MESMA definição de missão disparada/agrupada p/ N contatos,
// com poder de adicionar mais contatos depois (reusa criarMissaoEmLote).
import { conferirDono, tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { criarMissaoEmLote, iniciarMissoesConfiguradas } from '../missoes/missoes.caso-uso'

type DefCampanha = {
  nome: string
  numeroId: string
  tipo?: string
  modo?: string
  objetivo: string
  contexto?: string
  criterioConclusao?: string
  tom?: string
  informacoes?: string
}

export async function listarCampanhas() {
  const tenantId = await tenantAtual()
  const [campanhas, concluidas, pendentes] = await Promise.all([
    db.campanha.findMany({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { missoes: true } } },
    }),
    db.missao.groupBy({
      by: ['campanhaId'],
      where: { tenantId, estado: 'concluida', campanhaId: { not: null } },
      _count: { _all: true },
    }),
    // missões ainda paradas em 'configurada' (nunca disparadas) — pra oferecer "Disparar"
    db.missao.groupBy({
      by: ['campanhaId'],
      where: { tenantId, estado: 'configurada', campanhaId: { not: null } },
      _count: { _all: true },
    }),
  ])
  const mapaConcl = new Map(concluidas.map((g) => [g.campanhaId, g._count._all]))
  const mapaPend = new Map(pendentes.map((g) => [g.campanhaId, g._count._all]))
  return campanhas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    objetivo: c.objetivo,
    numeroId: c.numeroId,
    criadoEm: c.criadoEm,
    total: c._count.missoes,
    cumpridas: mapaConcl.get(c.id) ?? 0,
    pendentes: mapaPend.get(c.id) ?? 0,
  }))
}

// Dispara a campanha: inicia todas as missões ainda paradas ('configurada') dela.
// Reusa o início em lote (guardas anti-ban + relatório do que iniciou/pulou).
export async function iniciarCampanha(id: string) {
  const campanha = await db.campanha.findUnique({ where: { id }, select: { tenantId: true } })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  const pendentes = await db.missao.findMany({
    where: { campanhaId: id, estado: 'configurada' },
    select: { id: true },
  })
  return iniciarMissoesConfiguradas(pendentes.map((m) => m.id))
}

type Alvo = { contatos?: { telefone: string; nome?: string }[]; tagId?: string }

// cria a campanha (definição) + dispara pros contatos (cada um vira uma missão)
export async function criarCampanha(input: DefCampanha & Alvo) {
  const tenantId = await tenantAtual()
  const numero = await db.numeroWhatsapp.findUnique({ where: { id: input.numeroId } })
  if (!numero || numero.tenantId !== tenantId) throw new ErroHttp(404, 'Número não encontrado')

  const campanha = await db.campanha.create({
    data: {
      tenantId,
      numeroId: input.numeroId,
      nome: input.nome,
      tipo: input.tipo ?? 'vender',
      modo: input.modo ?? 'auto',
      objetivo: input.objetivo,
      contexto: input.contexto,
      criterioConclusao: input.criterioConclusao,
      tom: input.tom,
      informacoes: input.informacoes,
    },
  })
  const { criadas } = await dispararDaCampanha(campanha, { contatos: input.contatos, tagId: input.tagId })
  return { campanha, criadas }
}

export async function obterCampanha(id: string) {
  const campanha = await db.campanha.findUnique({
    where: { id },
    include: { missoes: { orderBy: { criadoEm: 'desc' }, include: { contato: true } } },
  })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  return campanha
}

// adiciona mais contatos a uma campanha em andamento (mesma definição → novas missões)
export async function adicionarContatosCampanha(id: string, alvo: Alvo) {
  const campanha = await db.campanha.findUnique({ where: { id } })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  return dispararDaCampanha(campanha, alvo)
}

// helper: cria as missões a partir da definição da campanha (contatos avulsos e/ou tag)
function dispararDaCampanha(
  campanha: {
    id: string
    numeroId: string
    tipo: string
    modo: string
    objetivo: string
    contexto: string | null
    criterioConclusao: string | null
    tom: string | null
    informacoes: string | null
  },
  alvo: Alvo,
) {
  return criarMissaoEmLote({
    numeroId: campanha.numeroId,
    tipo: campanha.tipo,
    modo: campanha.modo,
    objetivo: campanha.objetivo,
    contexto: campanha.contexto ?? undefined,
    criterioConclusao: campanha.criterioConclusao ?? undefined,
    tom: campanha.tom ?? undefined,
    informacoes: campanha.informacoes ?? undefined,
    campanhaId: campanha.id,
    contatos: alvo.contatos,
    tagId: alvo.tagId,
  })
}
