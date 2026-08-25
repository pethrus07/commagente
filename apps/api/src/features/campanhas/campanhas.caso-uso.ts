// ⚙️ Aplicação — campanhas: a MESMA definição de missão disparada/agrupada p/ N contatos,
// com poder de adicionar mais contatos depois (reusa criarMissaoEmLote).
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { ia } from '../../core/ia'
import { lerCamadaDna } from '../tenant/tenant.dna'
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
  midiaIds?: string[] // biblioteca curada da campanha (herdada por cada missão dela)
  dna?: unknown // camada de DNA da campanha (#9 Fase B): {categoria:{modo,texto}}; validado na rota
  estilo?: unknown // perfil de conversa da campanha (validado na rota); herdado por cada missão
}

export async function listarCampanhas() {
  const tenantId = await tenantAtual()
  const [campanhas, porEstado] = await Promise.all([
    db.campanha.findMany({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { missoes: true } } },
    }),
    // 1 groupBy por (campanha, estado) → breakdown completo p/ os indicadores do card (tela 03)
    db.missao.groupBy({
      by: ['campanhaId', 'estado'],
      where: { tenantId, campanhaId: { not: null } },
      _count: { _all: true },
    }),
  ])
  // campanhaId → { estado: quantidade }
  const mapaEstados = new Map<string, Record<string, number>>()
  for (const g of porEstado) {
    if (!g.campanhaId) continue
    const atual = mapaEstados.get(g.campanhaId) ?? {}
    atual[g.estado] = g._count._all
    mapaEstados.set(g.campanhaId, atual)
  }
  return campanhas.map((c) => {
    const estados = mapaEstados.get(c.id) ?? {}
    return {
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    objetivo: c.objetivo,
    numeroId: c.numeroId,
    criadoEm: c.criadoEm,
    total: c._count.missoes,
    cumpridas: estados.concluida ?? 0,
    pendentes: estados.configurada ?? 0, // ainda paradas ('configurada') → oferece "Disparar"
    porEstado: estados, // breakdown por estado p/ os indicadores dinâmicos do card
    pausada: c.pausada,
    // flags p/ o card refletir as camadas configuradas (#9): nº de categorias de DNA + nº de mídias
    dnaAjustes: Object.keys(lerCamadaDna(c.dna)).length,
    midias: c.midiaIds.length,
    }
  })
}

// Pausa/retoma a campanha inteira: enquanto pausada, a IA não envia nem responde nas missões dela
// (o worker segura a fila; processarTurno não gera). Histórico preservado — retoma de onde parou.
export async function pausarCampanha(id: string, pausada: boolean) {
  const campanha = await db.campanha.findUnique({ where: { id }, select: { tenantId: true } })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  await db.campanha.update({ where: { id }, data: { pausada } })
  return { ok: true as const, pausada }
}

// EXCLUI a campanha e TUDO que pende dela (missões, mensagens, fila, eventos), numa transação.
// Não há cascade no schema, então a ordem importa (filhos antes dos pais). Contatos NÃO são
// apagados (são compartilhados); o conhecimento aprendido é só DESVINCULADO da missão (preserva
// a base). Ação destrutiva → a UI confirma antes.
export async function excluirCampanha(id: string) {
  const campanha = await db.campanha.findUnique({ where: { id }, select: { tenantId: true } })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  const missoes = await db.missao.findMany({ where: { campanhaId: id }, select: { id: true } })
  const missaoIds = missoes.map((m) => m.id)
  await db.$transaction([
    db.mensagem.deleteMany({ where: { missaoId: { in: missaoIds } } }),
    db.filaEnvio.deleteMany({ where: { missaoId: { in: missaoIds } } }),
    db.evento.deleteMany({ where: { missaoId: { in: missaoIds } } }),
    // conhecimento aprendido nessas missões: preserva o conteúdo, só solta a proveniência
    db.conhecimento.updateMany({ where: { missaoId: { in: missaoIds } }, data: { missaoId: null } }),
    db.missao.deleteMany({ where: { campanhaId: id } }),
    db.campanha.delete({ where: { id } }),
  ])
  return { ok: true as const, missoesExcluidas: missaoIds.length }
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
      midiaIds: input.midiaIds ?? [],
      dna: (input.dna ?? undefined) as Prisma.InputJsonValue | undefined,
      estilo: (input.estilo ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
  // se o disparo resolver a audiência pra vazio (ex.: tag/lista só com opt-out), não
  // deixa uma campanha órfã: desfaz a criação e devolve o erro claro.
  try {
    const { criadas } = await dispararDaCampanha(campanha, { contatos: input.contatos, tagId: input.tagId })
    if (criadas === 0) throw new ErroHttp(400, 'Nenhum contato válido pra disparar (todos podem estar em opt-out).')
    return { campanha, criadas }
  } catch (e) {
    await db.campanha.delete({ where: { id: campanha.id } }).catch(() => {})
    throw e
  }
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

// Duplica a DEFINIÇÃO da campanha (sem missões/contatos) — base pra teste A/B: clona, você ajusta
// a variante (objetivo/tom/DNA/mídia/estilo) e dispara pro outro segmento.
export async function duplicarCampanha(id: string) {
  const orig = await db.campanha.findUnique({ where: { id } })
  if (!orig) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(orig.tenantId)
  const nova = await db.campanha.create({
    data: {
      tenantId: orig.tenantId,
      numeroId: orig.numeroId,
      nome: `${orig.nome} (cópia)`,
      tipo: orig.tipo,
      modo: orig.modo,
      objetivo: orig.objetivo,
      contexto: orig.contexto,
      criterioConclusao: orig.criterioConclusao,
      tom: orig.tom,
      informacoes: orig.informacoes,
      midiaIds: orig.midiaIds,
      dna: (orig.dna ?? undefined) as Prisma.InputJsonValue | undefined,
      estilo: (orig.estilo ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, nome: true },
  })
  return nova
}

// #9 — edita a definição da campanha (config + camadas). DNA e mídia refletem VIVO nas missões
// dela; os demais campos (objetivo/tom/…) são a DEFINIÇÃO — valem pras próximas missões da campanha
// (as já criadas guardam o snapshot). Só mexe no que veio no patch.
export async function editarCampanha(
  id: string,
  patch: {
    nome?: string
    tipo?: string
    modo?: string
    objetivo?: string
    contexto?: string | null
    criterioConclusao?: string | null
    tom?: string | null
    informacoes?: string | null
    estilo?: unknown
    dna?: unknown
    midiaIds?: string[]
  },
) {
  const campanha = await db.campanha.findUnique({ where: { id }, select: { tenantId: true } })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)
  const data: Prisma.CampanhaUpdateInput = {}
  if (patch.nome !== undefined) data.nome = patch.nome
  if (patch.tipo !== undefined) data.tipo = patch.tipo
  if (patch.modo !== undefined) data.modo = patch.modo
  if (patch.objetivo !== undefined) data.objetivo = patch.objetivo
  if (patch.contexto !== undefined) data.contexto = patch.contexto
  if (patch.criterioConclusao !== undefined) data.criterioConclusao = patch.criterioConclusao
  if (patch.tom !== undefined) data.tom = patch.tom
  if (patch.informacoes !== undefined) data.informacoes = patch.informacoes
  if (patch.estilo !== undefined) data.estilo = (patch.estilo ?? undefined) as Prisma.InputJsonValue | undefined
  if (patch.dna !== undefined) data.dna = (patch.dna ?? undefined) as Prisma.InputJsonValue | undefined
  if (patch.midiaIds !== undefined) data.midiaIds = patch.midiaIds
  return db.campanha.update({ where: { id }, data, select: { id: true } })
}

/**
 * Relatório consolidado da campanha: reúne o CONTEÚDO coletado em cada conversa
 * (fatos + resumo + desfecho + estado, por contato) num formato tabulável — a matéria-prima
 * que já era salva por missão mas ninguém via junta. A síntese por IA é um passo à parte
 * (sob demanda) pra não custar tokens toda vez que se abre o relatório.
 */
export async function obterRelatorioCampanha(id: string) {
  const campanha = await db.campanha.findUnique({
    where: { id },
    include: {
      missoes: {
        orderBy: { criadoEm: 'desc' },
        include: { contato: { select: { nome: true, telefone: true } } },
      },
    },
  })
  if (!campanha) throw new ErroHttp(404, 'Campanha não encontrada')
  await conferirDono(campanha.tenantId)

  const linhas = campanha.missoes.map((m) => ({
    missaoId: m.id,
    contato: m.contato?.nome ?? m.contato?.telefone ?? '—',
    telefone: m.contato?.telefone ?? '',
    estado: m.estado,
    resultado: m.resultado,
    resumo: m.resumo,
    fatos: (m.fatos ?? {}) as Record<string, unknown>,
  }))

  // contadores por estado (o placar detalhado)
  const porEstado: Record<string, number> = {}
  for (const m of campanha.missoes) porEstado[m.estado] = (porEstado[m.estado] ?? 0) + 1

  // união das chaves de fatos → viram as COLUNAS da tabela de coleta
  const camposFatos = Array.from(new Set(linhas.flatMap((l) => Object.keys(l.fatos)))).sort()

  return {
    campanha: {
      id: campanha.id,
      nome: campanha.nome,
      objetivo: campanha.objetivo,
      tipo: campanha.tipo,
      criadoEm: campanha.criadoEm,
    },
    total: campanha.missoes.length,
    concluidas: porEstado['concluida'] ?? 0,
    escaladas: porEstado['escalada'] ?? 0,
    porEstado,
    camposFatos,
    linhas,
  }
}

// Exporta o relatório da campanha como CSV (linhas = contatos, colunas = campos coletados).
export async function relatorioCampanhaCsv(id: string): Promise<{ nome: string; csv: string }> {
  const rel = await obterRelatorioCampanha(id)
  const cols = ['contato', 'telefone', 'estado', 'desfecho', 'resumo', ...rel.camposFatos]
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const linhas = rel.linhas.map((l) =>
    [
      l.contato,
      l.telefone,
      l.estado,
      l.resultado ?? '',
      l.resumo ?? '',
      ...rel.camposFatos.map((k) => l.fatos[k]),
    ]
      .map(esc)
      .join(','),
  )
  return { nome: rel.campanha.nome, csv: [cols.join(','), ...linhas].join('\n') }
}

// Consolida o relatório com IA: um resumo gerencial narrativo do que foi coletado.
// Sob demanda (custa tokens) — o painel chama num botão, não ao abrir o relatório.
export async function sintetizarRelatorioCampanha(id: string) {
  const rel = await obterRelatorioCampanha(id) // já confere dono (404 cross-tenant)
  const { texto, uso } = await ia.sintetizar({
    objetivo: rel.campanha.objetivo,
    tipo: rel.campanha.tipo,
    total: rel.total,
    linhas: rel.linhas.map((l) => ({
      contato: l.contato,
      estado: l.estado,
      resultado: l.resultado,
      resumo: l.resumo,
      fatos: l.fatos,
    })),
  })
  return { sintese: texto, uso }
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
    estilo?: Prisma.JsonValue
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
    // NÃO copia a mídia da campanha p/ a missão: ela é herdada AO VIVO no montador (igual ao DNA),
    // então editar a mídia da campanha reflete em todas as missões dela. [§9 — paridade com DNA]
    estilo: campanha.estilo ?? undefined,
    campanhaId: campanha.id,
    contatos: alvo.contatos,
    tagId: alvo.tagId,
  })
}
