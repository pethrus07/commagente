// ⚙️ Aplicação — tags de contato (segmentação do CRM). Permite marcar contatos e
// depois disparar missão/campanha para "todos da tag X".
import { conferirDono, tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'

export async function listarTags() {
  const tenantId = await tenantAtual()
  const tags = await db.tag.findMany({
    where: { tenantId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { contatos: true } } },
  })
  return tags.map((t) => ({
    id: t.id,
    nome: t.nome,
    cor: t.cor,
    total: t._count.contatos,
    criadoEm: t.criadoEm,
  }))
}

export async function criarTag(input: { nome: string; cor?: string }) {
  const tenantId = await tenantAtual()
  const nome = input.nome.trim()
  if (!nome) throw new ErroHttp(400, 'Nome da tag é obrigatório.')
  const existente = await db.tag.findUnique({
    where: { tenantId_nome: { tenantId, nome } },
  })
  if (existente) return existente // idempotente: já existe, devolve
  return db.tag.create({ data: { tenantId, nome, cor: input.cor ?? null } })
}

async function carregarTagDono(id: string) {
  const tag = await db.tag.findUnique({ where: { id } })
  if (!tag) throw new ErroHttp(404, 'Tag não encontrada')
  await conferirDono(tag.tenantId)
  return tag
}

export async function removerTag(id: string) {
  await carregarTagDono(id)
  await db.tag.delete({ where: { id } }) // cascade solta os vínculos
  return { ok: true }
}

// garante que o contato é do tenant da requisição (fecha IDOR)
async function conferirContato(contatoId: string) {
  const c = await db.contato.findUnique({ where: { id: contatoId }, select: { tenantId: true } })
  if (!c) throw new ErroHttp(404, 'Contato não encontrado')
  await conferirDono(c.tenantId)
}

export async function aplicarTag(contatoId: string, tagId: string) {
  await conferirContato(contatoId)
  await carregarTagDono(tagId)
  await db.contatoTag.upsert({
    where: { contatoId_tagId: { contatoId, tagId } },
    update: {},
    create: { contatoId, tagId },
  })
  return { ok: true }
}

export async function removerTagDoContato(contatoId: string, tagId: string) {
  await conferirContato(contatoId)
  await carregarTagDono(tagId)
  await db.contatoTag
    .delete({ where: { contatoId_tagId: { contatoId, tagId } } })
    .catch(() => {}) // se não existir o vínculo, ok
  return { ok: true }
}

// Resolve os contatos de uma tag (do tenant) no formato do disparo, EXCLUINDO opt-out.
// Pega TODOS os contatos da tag (o seletor do painel exibe só uma parte) — é o que
// permite "missão/campanha pra todos da tag X" pegar a base inteira do segmento.
export async function resolverContatosDaTag(
  tagId: string,
): Promise<{ telefone: string; nome?: string }[]> {
  const tag = await carregarTagDono(tagId)
  const vinculos = await db.contatoTag.findMany({
    where: { tagId, contato: { tenantId: tag.tenantId, optOut: false } },
    select: { contato: { select: { telefone: true, nome: true } } },
  })
  return vinculos.map((v) => ({
    telefone: v.contato.telefone,
    nome: v.contato.nome ?? undefined,
  }))
}

// aplica a MESMA tag a vários contatos de uma vez (ex.: seleção em massa / importação)
export async function aplicarTagEmLote(tagId: string, contatoIds: string[]) {
  const tag = await carregarTagDono(tagId)
  // só contatos do tenant da tag (evita marcar contato de outro tenant)
  const validos = await db.contato.findMany({
    where: { id: { in: contatoIds }, tenantId: tag.tenantId },
    select: { id: true },
  })
  if (validos.length === 0) return { aplicados: 0 }
  await db.contatoTag.createMany({
    data: validos.map((c) => ({ contatoId: c.id, tagId })),
    skipDuplicates: true,
  })
  return { aplicados: validos.length }
}
