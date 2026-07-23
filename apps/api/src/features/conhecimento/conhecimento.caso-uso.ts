// ⚙️ Aplicação — curadoria da base de conhecimento (memória coletiva do tenant).
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { extrairTexto } from '../../core/documentos/extrair-texto'
import { ErroHttp } from '../../core/erros'
import { conhecimentoRepo } from './conhecimento.repo'

export async function listarConhecimento() {
  return conhecimentoRepo.listar(await tenantAtual())
}

export async function criarConhecimento(input: { titulo: string; conteudo: string }) {
  const tenantId = await tenantAtual()
  return conhecimentoRepo.criar({
    tenantId,
    titulo: input.titulo,
    conteudo: input.conteudo,
    status: 'aprovado', // criado na mão já vale
    origem: 'manual',
  })
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
  const LIMITE = 16000
  const conteudo =
    texto.length > LIMITE ? texto.slice(0, LIMITE) + '\n\n…(texto truncado — documento longo)' : texto
  return conhecimentoRepo.criar({
    tenantId,
    titulo: tituloDoArquivo(input.nomeArquivo),
    conteudo,
    status: 'aprovado',
    origem: 'documento',
  })
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
  return conhecimentoRepo.atualizar(id, { status })
}

export async function editarConhecimento(
  id: string,
  patch: { titulo?: string; conteudo?: string },
) {
  await carregarDono(id)
  const data: Prisma.ConhecimentoUpdateInput = {}
  if (patch.titulo !== undefined) data.titulo = patch.titulo
  if (patch.conteudo !== undefined) data.conteudo = patch.conteudo
  return conhecimentoRepo.atualizar(id, data)
}

export async function excluirConhecimento(id: string) {
  await carregarDono(id)
  await conhecimentoRepo.excluir(id)
  return { ok: true }
}
