// ⚙️ Aplicação — casos de uso de missão.
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { garantirTenantPadrao } from '../../core/tenant'
import { processarTurno } from '../conversa/conversa.caso-uso'
import { validarTransicao } from './missao.dominio'
import { missoesRepo } from './missoes.repo'

export async function criarMissao(input: {
  telefone: string
  numeroId: string
  objetivo: string
  contexto?: string
  tom?: string
  informacoes?: string
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
    tom: input.tom,
    informacoes: input.informacoes,
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

// Edita a config da missão (objetivo/contexto/tom/informações) — reflete no próximo turno.
// O nome do contato é atualizado à parte (mora em Contato).
export async function editarMissao(
  id: string,
  patch: {
    objetivo?: string
    contexto?: string | null
    tom?: string | null
    informacoes?: string | null
    nomeContato?: string
  },
) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')

  const dados: Prisma.MissaoUpdateInput = {}
  if (patch.objetivo !== undefined) dados.objetivo = patch.objetivo
  if (patch.contexto !== undefined) dados.contexto = patch.contexto
  if (patch.tom !== undefined) dados.tom = patch.tom
  if (patch.informacoes !== undefined) dados.informacoes = patch.informacoes

  if (patch.nomeContato !== undefined) {
    await db.contato.update({
      where: { id: missao.contatoId },
      data: { nome: patch.nomeContato || null },
    })
  }

  const atualizada = Object.keys(dados).length
    ? await missoesRepo.atualizar(id, dados)
    : missao

  await db.evento.create({
    data: {
      tenantId: missao.tenantId,
      missaoId: id,
      tipo: 'missao_editada',
      dados: { campos: Object.keys({ ...dados, ...(patch.nomeContato !== undefined ? { nomeContato: 1 } : {}) }) },
    },
  })
  return atualizada
}

// Modo A — inicia a missão: a IA gera a 1ª mensagem (opener) e enfileira.
export async function iniciarMissao(id: string) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  if (missao.estado === 'configurada') {
    await missoesRepo.atualizarEstado(id, 'na_fila')
  }
  await processarTurno(id) // gera opener via IA + enfileira; worker envia
  return { ok: true, iniciada: true }
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
