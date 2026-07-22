// ⚙️ Aplicação — curadoria da base de conhecimento (memória coletiva do tenant).
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
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
