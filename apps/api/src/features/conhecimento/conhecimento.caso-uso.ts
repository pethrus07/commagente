// ⚙️ Aplicação — curadoria da base de conhecimento (memória coletiva do tenant).
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto.js'
import { extrairTexto } from '../../core/documentos/extrair-texto.js'
import { embeddings } from '../../core/embeddings/index.js'
import { similaridadeCosseno } from '../../core/embeddings/porta-embeddings.js'
import { ErroHttp } from '../../core/erros.js'
import { dividirEmChunks } from './conhecimento.dominio.js'
import { conhecimentoRepo } from './conhecimento.repo.js'

// (RE)INDEXAÇÃO p/ RAG: fatia o conteúdo aprovado e vetoriza cada trecho.
// Best-effort — nunca derruba a criação/edição do conhecimento (se a OpenAI falhar,
// o item continua salvo; a recuperação cai no fallback até reindexar).
export async function reindexar(id: string) {
  const item = await conhecimentoRepo.buscar(id)
  if (!item) return
  if (item.status !== 'aprovado') {
    await conhecimentoRepo.limparChunks(id)
    return
  }
  const trechos = dividirEmChunks(item.conteudo)
  if (trechos.length === 0) {
    await conhecimentoRepo.limparChunks(id)
    return
  }
  const vetores = await embeddings.gerar(trechos)
  await conhecimentoRepo.substituirChunks(
    id,
    item.tenantId,
    trechos.map((c, i) => ({ ordem: i, conteudo: c, embedding: vetores[i] ?? [] })),
  )
}

function reindexarBg(id: string) {
  reindexar(id).catch((e) => console.error('[conhecimento] reindex falhou:', e))
}

// RECUPERAÇÃO por relevância (RAG). SEMPRE devolve um string[] utilizável — NUNCA lança
// e NUNCA retorna null (o harness chama isto no caminho crítico do turno; um erro de rede
// aqui não pode derrubar/descartar a conversa). Combina:
//  - RAG: top-k trechos mais próximos (cosseno) quando há embeddings semânticos + base indexada;
//  - itens aprovados SEM chunk compatível (não-indexados, ou indexados com outra dimensão):
//    entram INTEIROS, pra nunca sumirem da IA silenciosamente;
//  - fallback total: se RAG indisponível/erro, devolve todo o conhecimento aprovado.
export async function conhecimentoRelevante(
  tenantId: string,
  consulta: string,
  k = 6,
): Promise<string[]> {
  const aprovados = await conhecimentoRepo.aprovados(tenantId)
  const tudo = () => aprovados.map((c) => `${c.titulo}: ${c.conteudo}`)
  const texto = consulta.trim()
  if (!embeddings.semantico || !texto || aprovados.length === 0) return tudo()
  try {
    const chunks = await conhecimentoRepo.chunksDoTenant(tenantId)
    if (chunks.length === 0) return tudo()
    const [q] = await embeddings.gerar([texto])
    if (!q) return tudo()
    // GUARDA DE DIMENSÃO: só compara chunks do mesmo tamanho do vetor de consulta.
    // (trocar o provider de embeddings muda a dimensão — ex.: dublê 64 vs OpenAI 1536;
    // comparar dims diferentes daria ranking lixo. Chunks de outra dim = "não-indexados".)
    const compat = chunks.filter((c) => c.embedding.length === q.length)
    const indexados = new Set(compat.map((c) => c.conhecimentoId))
    const relevantes = compat
      .map((c) => ({ conteudo: c.conteudo, s: similaridadeCosseno(q, c.embedding) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((r) => r.conteudo)
    // itens aprovados que NÃO têm chunk compatível → inclui inteiros (não some da IA)
    const naoIndexados = aprovados
      .filter((c) => !indexados.has(c.id))
      .map((c) => `${c.titulo}: ${c.conteudo}`)
    const combinado = [...relevantes, ...naoIndexados]
    return combinado.length ? combinado : tudo()
  } catch (e) {
    console.error('[rag] recuperação falhou (usando todo o conhecimento):', e)
    return tudo()
  }
}

export async function listarConhecimento() {
  return conhecimentoRepo.listar(await tenantAtual())
}

export async function criarConhecimento(input: { titulo: string; conteudo: string; categoria?: string | null }) {
  const tenantId = await tenantAtual()
  const item = await conhecimentoRepo.criar({
    tenantId,
    titulo: input.titulo,
    conteudo: input.conteudo,
    status: 'aprovado', // criado na mão já vale
    origem: 'manual',
    categoria: input.categoria ?? null,
  })
  reindexarBg(item.id)
  return item
}

// nome de exibição a partir do arquivo (sem caminho/extensão)
function tituloDoArquivo(nome: string): string {
  const base = (nome.split(/[\\/]/).pop() || nome).replace(/\.[^.]+$/, '')
  return base.replace(/[_-]+/g, ' ').trim().slice(0, 120) || 'Documento'
}

// Ingestão (a): extrai o texto do documento (PDF/DOCX/TXT) e grava como uma entrada
// de Conhecimento do tenant — passa a valer como fonte da verdade em toda missão.
export async function importarDocumento(input: {
  nomeArquivo: string
  mimetype: string
  base64: string
  categoria?: string | null
}) {
  const tenantId = await tenantAtual()
  const texto = await extrairTexto(input.base64, input.mimetype, input.nomeArquivo)
  if (!texto || texto.replace(/\s/g, '').length < 20) {
    throw new ErroHttp(
      400,
      'Não consegui extrair texto legível. PDF que é só imagem/scan não tem texto — use um PDF com texto selecionável, DOCX ou TXT.',
    )
  }
  // com RAG (chunks) o documento inteiro é recuperável por trecho — cabe bem mais texto.
  const LIMITE = 60000
  const conteudo =
    texto.length > LIMITE ? texto.slice(0, LIMITE) + '\n\n…(texto truncado — documento longo)' : texto
  const item = await conhecimentoRepo.criar({
    tenantId,
    titulo: tituloDoArquivo(input.nomeArquivo),
    conteudo,
    status: 'aprovado',
    origem: 'documento',
    categoria: input.categoria ?? null,
  })
  reindexarBg(item.id)
  return item
}

// ── Aprendizado por link (§8.14): cola a URL do site/loja → busca, extrai o texto e vira
// conhecimento (RAG). A IA lê 1× e guarda no acervo (não navega ao vivo a cada mensagem). ──
function urlSegura(u: string): URL {
  let url: URL
  try { url = new URL(u.trim()) } catch { throw new ErroHttp(400, 'URL inválida.') }
  if (!/^https?:$/.test(url.protocol)) throw new ErroHttp(400, 'Só aceito http(s).')
  const h = url.hostname.toLowerCase()
  // anti-SSRF: bloqueia localhost / redes internas / link-local
  const interno =
    h === 'localhost' || h.endsWith('.local') || h === '::1' || h.startsWith('fe80') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  if (interno) throw new ErroHttp(400, 'Endereço interno não é permitido.')
  return url
}

function htmlParaTexto(html: string): { titulo: string; texto: string } {
  const titulo = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim()
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ') // tira menu/rodapé (ruído)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return { titulo, texto }
}

export async function importarUrl(input: { url: string; categoria?: string | null }) {
  const tenantId = await tenantAtual()
  const url = urlSegura(input.url)
  let html: string
  try {
    const resp = await fetch(url.toString(), {
      headers: { 'user-agent': 'CommagenteBot/1.0 (+https://commagente.com.br)', accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!resp.ok) throw new Error(`o site respondeu ${resp.status}`)
    const ct = resp.headers.get('content-type') ?? ''
    if (!/html|text|xml/.test(ct)) throw new Error('o link não é uma página de texto')
    const buf = await resp.arrayBuffer()
    if (buf.byteLength > 6 * 1024 * 1024) throw new Error('página grande demais')
    html = Buffer.from(buf).toString('utf8')
  } catch (e) {
    throw new ErroHttp(502, `Não consegui ler o site: ${(e as Error).message}.`)
  }
  const { titulo, texto } = htmlParaTexto(html)
  if (texto.replace(/\s/g, '').length < 40) {
    throw new ErroHttp(400, 'A página não tem texto legível (talvez seja renderizada por JavaScript). Cole o conteúdo à mão, ou tente uma página mais simples.')
  }
  const LIMITE = 60000
  const conteudo = `Fonte: ${url.toString()}\n\n${texto.length > LIMITE ? `${texto.slice(0, LIMITE)}\n\n…(texto truncado)` : texto}`
  const item = await conhecimentoRepo.criar({
    tenantId,
    titulo: (titulo || url.hostname).slice(0, 120),
    conteudo,
    status: 'aprovado',
    origem: 'link',
    categoria: input.categoria ?? null,
  })
  reindexarBg(item.id)
  return item
}

async function carregarDono(id: string) {
  const item = await conhecimentoRepo.buscar(id)
  if (!item) throw new ErroHttp(404, 'Conhecimento não encontrado')
  await conferirDono(item.tenantId)
  return item
}

export async function definirStatusConhecimento(
  id: string,
  status: 'aprovado' | 'rejeitado',
) {
  await carregarDono(id)
  const item = await conhecimentoRepo.atualizar(id, { status })
  // aprovado → indexa (vira consultável); rejeitado → limpa os chunks
  reindexarBg(id)
  return item
}

export async function editarConhecimento(
  id: string,
  patch: { titulo?: string; conteudo?: string; categoria?: string | null },
) {
  await carregarDono(id)
  const data: Prisma.ConhecimentoUpdateInput = {}
  if (patch.titulo !== undefined) data.titulo = patch.titulo
  if (patch.conteudo !== undefined) data.conteudo = patch.conteudo
  if (patch.categoria !== undefined) data.categoria = patch.categoria
  const item = await conhecimentoRepo.atualizar(id, data)
  // conteúdo mudou → reindexa (chunks/embeddings ficam consistentes)
  if (patch.conteudo !== undefined) reindexarBg(id)
  return item
}

export async function excluirConhecimento(id: string) {
  await carregarDono(id)
  await conhecimentoRepo.excluir(id)
  return { ok: true }
}
