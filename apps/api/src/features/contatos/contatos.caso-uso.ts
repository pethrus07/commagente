// ⚙️ Aplicação — contatos (o "C" do CRM): listar, criar, importar (CSV/WhatsApp), exportar, DNA.
import { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { whatsapp } from '../../core/evolution'
import { type DnaContato, dnaContatoSchema, lerDnaContato } from './contato.dna'

function normalizarTelefone(t: string): string {
  return (t ?? '').replace(/\D/g, '')
}

export async function listarContatos() {
  const tenantId = await tenantAtual()
  const contatos = await db.contato.findMany({
    where: { tenantId },
    orderBy: { criadoEm: 'desc' },
    include: {
      _count: { select: { missoes: true } },
      tags: { include: { tag: { select: { id: true, nome: true, cor: true } } } },
    },
  })
  return contatos.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    origem: c.origem,
    optOut: c.optOut,
    criadoEm: c.criadoEm,
    totalMissoes: c._count.missoes,
    tags: c.tags.map((ct) => ct.tag),
  }))
}

// detalhe de um contato (inclui o DNA) — com checagem de dono (anti-IDOR).
export async function obterContato(id: string) {
  const c = await db.contato.findUnique({
    where: { id },
    include: { tags: { include: { tag: { select: { id: true, nome: true, cor: true } } } } },
  })
  if (!c) throw new ErroHttp(404, 'Contato não encontrado')
  await conferirDono(c.tenantId)
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    origem: c.origem,
    optOut: c.optOut,
    criadoEm: c.criadoEm,
    dna: lerDnaContato(c.dna), // só as categorias preenchidas
    tags: c.tags.map((ct) => ct.tag),
  }
}

// grava o DNA do contato com semântica de PATCH/merge (categoria ausente = mantém; vazia = limpa).
// Anti-IDOR: só grava se o contato for do tenant da requisição. {} → não muda nada.
export async function definirDnaContato(id: string, patch: unknown): Promise<DnaContato> {
  const atual = await db.contato.findUnique({ where: { id }, select: { tenantId: true, dna: true } })
  if (!atual) throw new ErroHttp(404, 'Contato não encontrado')
  await conferirDono(atual.tenantId)
  const mesclado = { ...lerDnaContato(atual.dna), ...dnaContatoSchema.partial().parse(patch ?? {}) }
  const limpo = lerDnaContato(mesclado) // descarta categorias que ficaram vazias
  const valor = Object.keys(limpo).length ? (limpo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
  await db.contato.update({ where: { id }, data: { dna: valor } })
  return limpo
}

export async function criarContato(input: { nome?: string; telefone: string }) {
  const tenantId = await tenantAtual()
  const telefone = normalizarTelefone(input.telefone)
  if (telefone.length < 8) throw new ErroHttp(400, 'Telefone inválido (use DDI+DDD).')
  return db.contato.upsert({
    where: { tenantId_telefone: { tenantId, telefone } },
    update: input.nome ? { nome: input.nome } : {},
    create: {
      tenantId,
      telefone,
      nome: input.nome,
      origem: 'manual',
      optInEm: new Date(),
      optInOrigem: 'manual',
    },
  })
}

// upsert em lote (usado por importar CSV e importar do WhatsApp)
async function upsertLote(
  tenantId: string,
  linhas: { nome?: string; telefone: string }[],
  origem: string,
) {
  let criados = 0
  let atualizados = 0
  let ignorados = 0
  for (const l of linhas) {
    const telefone = normalizarTelefone(l.telefone)
    if (telefone.length < 8) {
      ignorados++
      continue
    }
    const existente = await db.contato.findUnique({
      where: { tenantId_telefone: { tenantId, telefone } },
      select: { id: true },
    })
    if (existente) {
      if (l.nome) await db.contato.update({ where: { id: existente.id }, data: { nome: l.nome } })
      atualizados++
    } else {
      await db.contato.create({
        data: { tenantId, telefone, nome: l.nome, origem, optInEm: new Date(), optInOrigem: origem },
      })
      criados++
    }
  }
  return { criados, atualizados, ignorados, total: linhas.length }
}

export async function importarContatos(linhas: { nome?: string; telefone: string }[]) {
  const tenantId = await tenantAtual()
  return upsertLote(tenantId, linhas, 'importacao_csv')
}

export async function importarDoWhatsApp(numeroId: string) {
  const tenantId = await tenantAtual()
  const numero = await db.numeroWhatsapp.findUnique({ where: { id: numeroId } })
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  await conferirDono(numero.tenantId)
  let contatos: { telefone: string; nome?: string }[]
  try {
    contatos = await whatsapp.buscarContatos(numero.instanciaEvolution)
  } catch {
    throw new ErroHttp(502, 'Não consegui ler a agenda do WhatsApp. O número está conectado?')
  }
  return upsertLote(tenantId, contatos, 'importacao_whatsapp')
}

export async function exportarContatosCSV(): Promise<string> {
  const tenantId = await tenantAtual()
  const contatos = await db.contato.findMany({
    where: { tenantId },
    orderBy: { criadoEm: 'desc' },
  })
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const linhas = ['nome,telefone,origem,opt_out,criado_em']
  for (const c of contatos) {
    linhas.push(
      [
        esc(c.nome ?? ''),
        esc(c.telefone),
        esc(c.origem ?? ''),
        c.optOut ? 'sim' : 'nao',
        esc(c.criadoEm.toISOString()),
      ].join(','),
    )
  }
  return linhas.join('\n')
}
