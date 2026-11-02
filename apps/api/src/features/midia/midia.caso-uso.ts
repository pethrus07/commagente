// ⚙️ Aplicação — biblioteca de mídia do tenant: arquivos "bonitos" (catálogo, tabela de preço,
// PDF) que a IA pode ENVIAR ao contato quando fizer sentido (ação enviar_midia). [parceiro §8.15]
import { conferirDono, tenantAtual } from '../../core/contexto.js'
import { db } from '../../core/db.js'
import { ErroHttp } from '../../core/erros.js'

const MAX_BYTES = 12 * 1024 * 1024 // 12MB por arquivo

export async function listarMidias() {
  const tenantId = await tenantAtual()
  return db.midia.findMany({
    where: { tenantId },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, nome: true, mimetype: true, tamanho: true, criadoEm: true },
  })
}

export async function subirMidia(input: { nome: string; mimetype: string; base64: string }) {
  const tenantId = await tenantAtual()
  const buf = Buffer.from(input.base64, 'base64')
  if (buf.length === 0) throw new ErroHttp(400, 'Arquivo vazio.')
  if (buf.length > MAX_BYTES) throw new ErroHttp(400, `Arquivo grande demais (máx ${MAX_BYTES / 1024 / 1024}MB).`)
  const m = await db.midia.create({
    data: { tenantId, nome: input.nome.trim().slice(0, 120) || 'Mídia', mimetype: input.mimetype, tamanho: buf.length, dados: buf },
  })
  return { id: m.id, nome: m.nome, mimetype: m.mimetype, tamanho: m.tamanho, criadoEm: m.criadoEm }
}

export async function excluirMidia(id: string) {
  const m = await db.midia.findUnique({ where: { id }, select: { tenantId: true } })
  if (!m) throw new ErroHttp(404, 'Recurso não encontrado')
  await conferirDono(m.tenantId)
  await db.midia.delete({ where: { id } })
  return { ok: true }
}

// ── pro harness (não passa pela porta HTTP) ──
// lista leve (id + nome) pra IA saber o que PODE enviar
export async function midiasDoTenant(tenantId: string): Promise<{ id: string; nome: string }[]> {
  return db.midia.findMany({ where: { tenantId }, orderBy: { criadoEm: 'desc' }, select: { id: true, nome: true }, take: 20 })
}

// o arquivo pra enviar (tenant-scoped — anti-IDOR: só envia mídia do próprio tenant)
export async function midiaParaEnvio(id: string, tenantId: string) {
  const m = await db.midia.findFirst({ where: { id, tenantId }, select: { nome: true, mimetype: true, dados: true } })
  if (!m) return null
  return {
    nomeArquivo: nomeArquivo(m.nome, m.mimetype),
    mimetype: m.mimetype,
    base64: Buffer.from(m.dados).toString('base64'),
    legenda: m.nome,
  }
}

function nomeArquivo(nome: string, mime: string): string {
  const ext = mime.includes('pdf') ? '.pdf' : mime.includes('png') ? '.png' : /jpe?g/.test(mime) ? '.jpg' : ''
  const base = nome.replace(/[^\w.-]+/g, '_') || 'midia'
  return !ext || base.toLowerCase().endsWith(ext) ? base : base + ext
}
