// ⚙️ Aplicação — Central de Inteligência (#7): "pergunte qualquer coisa sobre os dados da conta".
// Junta um RETRATO estruturado do tenant e deixa a IA responder SÓ com base nele (grounded,
// anti-invenção). Não é RAG mágico sobre tudo — é agregado pré-computado + guardrail.
import { contexto, tenantAtual } from '../../core/contexto.js'
import { db } from '../../core/db.js'
import { ErroHttp } from '../../core/erros.js'
import { ia } from '../../core/ia/index.js'
import { listarCampanhas } from '../campanhas/campanhas.caso-uso.js'

function inicioDoDia(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Retrato bounded dos dados do tenant — a ÚNICA fonte da resposta da IA.
// Só agregados (nada de conteúdo de conversa cru): contadores, campanhas, desfechos recentes.
export async function montarRetrato(tenantId: string, ehSuper: boolean) {
  const [numeros, conectados, porEstadoRaw, campanhas, contatos, optOut, mensagensHoje, desfechos, custo, tags] =
    await Promise.all([
      db.numeroWhatsapp.count({ where: { tenantId } }),
      db.numeroWhatsapp.count({ where: { tenantId, statusConexao: 'conectado' } }),
      db.missao.groupBy({ by: ['estado'], where: { tenantId }, _count: { _all: true } }),
      listarCampanhas(), // já roda no contexto do tenant (tenantAtual)
      db.contato.count({ where: { tenantId } }),
      db.contato.count({ where: { tenantId, optOut: true } }),
      db.mensagem.count({ where: { tenantId, criadaEm: { gte: inicioDoDia() } } }),
      db.missao.findMany({
        where: { tenantId, estado: 'concluida', resultado: { not: null } },
        orderBy: { concluidaEm: 'desc' },
        take: 25,
        select: { resultado: true, categoriaResultado: true, contato: { select: { nome: true, telefone: true } } },
      }),
      ehSuper
        ? db.missao.aggregate({ where: { tenantId }, _sum: { tokensEntrada: true, tokensSaida: true } })
        : Promise.resolve(null),
      db.tag.findMany({ where: { tenantId }, select: { nome: true, _count: { select: { contatos: true } } }, take: 20 }),
    ])

  const porEstado: Record<string, number> = {}
  for (const g of porEstadoRaw) porEstado[g.estado] = g._count._all
  const totalMissoes = Object.values(porEstado).reduce((a, b) => a + b, 0)

  const retrato: Record<string, unknown> = {
    numeros: { total: numeros, conectados },
    missoes: { total: totalMissoes, porEstado },
    campanhas: campanhas.slice(0, 30).map((c) => ({
      nome: c.nome,
      tipo: c.tipo,
      objetivo: c.objetivo,
      total: c.total,
      cumpridas: c.cumpridas,
      pendentes: c.pendentes,
    })),
    contatos: {
      total: contatos,
      optOut,
      porTag: tags.map((t) => ({ tag: t.nome, contatos: t._count.contatos })).filter((t) => t.contatos > 0),
    },
    atividade: {
      mensagensHoje,
      desfechosRecentes: desfechos.map((d) => ({
        contato: d.contato?.nome ?? d.contato?.telefone ?? '—',
        desfecho: d.resultado,
        categoria: d.categoriaResultado,
      })),
    },
  }
  // custo (tokens) é confidencial da plataforma → só entra no retrato do super-admin
  if (ehSuper && custo) {
    retrato.custo = { tokensEntrada: custo._sum.tokensEntrada ?? 0, tokensSaida: custo._sum.tokensSaida ?? 0 }
  }
  return retrato
}

// Responde uma pergunta em linguagem natural sobre os dados da conta (grounded).
export async function perguntarSobreDados(input: { pergunta: string }) {
  const tenantId = await tenantAtual()
  const ehSuper = contexto.atual()?.papel === 'super_admin'
  const pergunta = input.pergunta.trim().slice(0, 500)
  if (!pergunta) throw new ErroHttp(400, 'Escreva uma pergunta.')

  const snapshot = await montarRetrato(tenantId, ehSuper)
  const { texto, uso } = await ia.analisar({ pergunta, snapshot })
  // custo (uso) só volta pro super-admin — informação confidencial da plataforma
  return { resposta: texto, uso: ehSuper ? uso : undefined }
}
