// ⚙️ Aplicação — curadoria da base de conhecimento (memória coletiva do tenant).
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { extrairTexto } from '../../core/documentos/extrair-texto'
import { embeddings } from '../../core/embeddings'
import { similaridadeCosseno } from '../../core/embeddings/porta-embeddings'
import { ErroHttp } from '../../core/erros'
import { dividirEmChunks } from './conhecimento.dominio'
import { conhecimentoRepo } from './conhecimento.repo'

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

// RECUPERAÇÃO por relevância (RAG): dado o texto da conversa, devolve os trechos mais
// próximos (cosseno). Retorna null quando NÃO dá pra usar RAG (embeddings não-semânticos
// ou base ainda sem chunks) → o harness cai no fallback "todo o conhecimento aprovado".
export async function conhecimentoRelevante(
  tenantId: string,
  consulta: string,
  k = 6,
): Promise<string[] | null> {
  if (!embeddings.semantico) return null
  const texto = consulta.trim()
  if (!texto) return null
  const chunks = await conhecimentoRepo.chunksDoTenant(tenantId)
  if (chunks.length === 0) return null
  const [q] = await embeddings.gerar([texto])
  if (!q) return null
  return chunks
    .map((c) => ({ conteudo: c.conteudo, s: similaridadeCosseno(q, c.embedding) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((r) => r.conteudo)
}

export async function listarConhecimento() {
  return conhecimentoRepo.listar(await tenantAtual())
}

export async function criarConhecimento(input: { titulo: string; conteudo: string }) {
  const tenantId = await tenantAtual()
  const item = await conhecimentoRepo.criar({
    tenantId,
    titulo: input.titulo,
    conteudo: input.conteudo,
    status: 'aprovado', // criado na mão já vale
    origem: 'manual',
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
  patch: { titulo?: string; conteudo?: string },
) {
  await carregarDono(id)
  const data: Prisma.ConhecimentoUpdateInput = {}
  if (patch.titulo !== undefined) data.titulo = patch.titulo
  if (patch.conteudo !== undefined) data.conteudo = patch.conteudo
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
