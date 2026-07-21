// ⚙️ Aplicação — casos de uso de missão.
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { garantirTenantPadrao } from '../../core/tenant'
import { validarTransicao } from './missao.dominio'
import { missoesRepo } from './missoes.repo'

export async function criarMissao(input: {
  telefone: string
  numeroId: string
  objetivo: string
  contexto?: string
  nomeContato?: string
}) {
  const tenantId = await garantirTenantPadrao()

  // garante o número
  const numero = await db.numeroWhatsapp.findUnique({
    where: { id: input.numeroId },
  })
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')

  // garante o contato (por telefone)
  const contato = await db.contato.upsert({
    where: { tenantId_telefone: { tenantId, telefone: input.telefone } },
    update: input.nomeContato ? { nome: input.nomeContato } : {},
    create: {
      tenantId,
      telefone: input.telefone,
      nome: input.nomeContato,
      origem: 'manual',
    },
  })

  const missao = await missoesRepo.criar({
    tenantId,
    contatoId: contato.id,
    numeroId: input.numeroId,
    objetivo: input.objetivo,
    contexto: input.contexto,
  })

  await db.evento.create({
    data: {
      tenantId,
      missaoId: missao.id,
      tipo: 'missao_criada',
      dados: { objetivo: input.objetivo, contatoId: contato.id },
    },
  })
  return missao
}

export async function listarMissoes() {
  const tenantId = await garantirTenantPadrao()
  return missoesRepo.listar(tenantId)
}

export async function obterMissao(id: string) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  return missao
}

export async function mudarEstado(id: string, novoEstado: EstadoMissao) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')

  validarTransicao(missao.estado, novoEstado) // lança 409 se inválida

  // carimba timestamps ao entrar em conversa / concluir
  const extra: Prisma.MissaoUpdateInput = {}
  if (novoEstado === 'em_conversa' && !missao.iniciadaEm) {
    extra.iniciadaEm = new Date()
  }
  if (novoEstado === 'concluida') extra.concluidaEm = new Date()

  const atualizada = await missoesRepo.atualizarEstado(id, novoEstado, extra)
  await db.evento.create({
    data: {
      tenantId: missao.tenantId,
      missaoId: id,
      tipo: 'estado_alterado',
      dados: { de: missao.estado, para: novoEstado },
    },
  })
  return atualizada
}
