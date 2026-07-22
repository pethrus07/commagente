// ⚙️ Aplicação — missões programadas: cadastro, agendador e disparo.
import type { Prisma } from '@prisma/client'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { processarTurno } from '../conversa/conversa.caso-uso'
import { jitterMs } from '../fila/fila.dominio'
import { filaRepo } from '../fila/fila.repo'
import { missoesRepo } from '../missoes/missoes.repo'
import { agendamentosRepo } from './agendamentos.repo'
import { cicloRef, ehDiaDeDisparo, ymd } from './agendamentos.dominio'

export interface DefAgendamento {
  numeroId: string
  tipo?: string
  modo?: string
  objetivo?: string
  contexto?: string
  criterioConclusao?: string
  tom?: string
  informacoes?: string
  recorrencia: 'uma_vez' | 'mensal'
  diaDoMes?: number
  dataUnica?: string // "YYYY-MM-DD"
  entrega: 'ia' | 'fixa'
  mensagemFixa?: string
  rotulo?: string
}

// "YYYY-MM-DD" → Date ao meio-dia BR (estável contra fuso na comparação de data).
function parseDataUnica(s?: string): Date | null {
  if (!s) return null
  const d = new Date(`${s}T12:00:00-03:00`)
  if (Number.isNaN(d.getTime())) throw new ErroHttp(400, 'dataUnica inválida (use YYYY-MM-DD).')
  return d
}

function validarBase(def: DefAgendamento) {
  if (def.recorrencia !== 'uma_vez' && def.recorrencia !== 'mensal')
    throw new ErroHttp(400, 'recorrencia inválida (uma_vez | mensal).')
  if (def.entrega !== 'ia' && def.entrega !== 'fixa')
    throw new ErroHttp(400, 'entrega inválida (ia | fixa).')
  if (def.entrega === 'fixa' && !def.mensagemFixa?.trim())
    throw new ErroHttp(400, 'Mensagem fixa é obrigatória quando a entrega é "fixa".')
  if (def.entrega === 'ia' && !def.objetivo?.trim())
    throw new ErroHttp(400, 'Objetivo é obrigatório quando a entrega é "IA".')
  if (def.recorrencia === 'uma_vez' && !def.dataUnica)
    throw new ErroHttp(400, 'dataUnica é obrigatória para agendamento de uma vez.')
}

function diaValido(dia?: number): boolean {
  return typeof dia === 'number' && Number.isInteger(dia) && dia >= 1 && dia <= 31
}

function montarDados(
  tenantId: string,
  contatoId: string,
  def: DefAgendamento,
  diaDoMes: number | null,
): Prisma.AgendamentoUncheckedCreateInput {
  return {
    tenantId,
    contatoId,
    numeroId: def.numeroId,
    tipo: def.tipo ?? 'cobrar',
    modo: def.modo ?? 'auto',
    objetivo: def.objetivo?.trim() || 'Cobrança programada',
    contexto: def.contexto?.trim() || null,
    criterioConclusao: def.criterioConclusao?.trim() || null,
    tom: def.tom?.trim() || null,
    informacoes: def.informacoes?.trim() || null,
    recorrencia: def.recorrencia,
    diaDoMes: def.recorrencia === 'mensal' ? diaDoMes : null,
    dataUnica: def.recorrencia === 'uma_vez' ? parseDataUnica(def.dataUnica) : null,
    entrega: def.entrega,
    mensagemFixa: def.entrega === 'fixa' ? def.mensagemFixa?.trim() || null : null,
    rotulo: def.rotulo?.trim() || null,
  }
}

async function conferirNumero(numeroId: string, tenantId: string) {
  const numero = await db.numeroWhatsapp.findUnique({ where: { id: numeroId } })
  if (!numero || numero.tenantId !== tenantId) throw new ErroHttp(404, 'Número não encontrado')
}

function upsertContato(tenantId: string, telefone: string, nome?: string) {
  return db.contato.upsert({
    where: { tenantId_telefone: { tenantId, telefone } },
    update: nome ? { nome } : {},
    create: { tenantId, telefone, nome, origem: 'agendamento', optInEm: new Date(), optInOrigem: 'agendamento' },
  })
}

export async function listarAgendamentos() {
  const tenantId = await tenantAtual()
  return agendamentosRepo.listar(tenantId)
}

export async function criarAgendamento(input: DefAgendamento & { telefone: string; nomeContato?: string }) {
  const tenantId = await tenantAtual()
  await conferirNumero(input.numeroId, tenantId)
  validarBase(input)
  if (input.recorrencia === 'mensal' && !diaValido(input.diaDoMes))
    throw new ErroHttp(400, 'diaDoMes deve ser um número de 1 a 31.')
  const telefone = input.telefone.replace(/\D/g, '')
  if (telefone.length < 8) throw new ErroHttp(400, 'Telefone inválido.')
  const contato = await upsertContato(tenantId, telefone, input.nomeContato)
  return agendamentosRepo.criar(montarDados(tenantId, contato.id, input, input.diaDoMes ?? null))
}

export async function criarAgendamentosEmLote(
  input: DefAgendamento & { contatos: { telefone: string; nome?: string; dia?: number }[] },
) {
  const tenantId = await tenantAtual()
  await conferirNumero(input.numeroId, tenantId)
  validarBase(input)
  let criados = 0
  let ignorados = 0
  for (const c of input.contatos) {
    const telefone = c.telefone.replace(/\D/g, '')
    if (telefone.length < 8) {
      ignorados++
      continue
    }
    let dia: number | null = null
    if (input.recorrencia === 'mensal') {
      dia = c.dia ?? input.diaDoMes ?? null
      if (!diaValido(dia ?? undefined)) {
        ignorados++
        continue // sem dia válido → pula a linha
      }
    }
    const contato = await upsertContato(tenantId, telefone, c.nome)
    await agendamentosRepo.criar(montarDados(tenantId, contato.id, input, dia))
    criados++
  }
  return { criados, ignorados }
}

export async function editarAgendamento(
  id: string,
  patch: {
    diaDoMes?: number
    ativo?: boolean
    objetivo?: string
    tom?: string
    informacoes?: string
    criterioConclusao?: string
    mensagemFixa?: string
    rotulo?: string
  },
) {
  const ag = await agendamentosRepo.buscar(id)
  if (!ag) throw new ErroHttp(404, 'Agendamento não encontrado')
  await conferirDono(ag.tenantId)
  if (patch.diaDoMes !== undefined && !diaValido(patch.diaDoMes))
    throw new ErroHttp(400, 'diaDoMes deve ser 1 a 31.')
  return agendamentosRepo.atualizar(id, patch)
}

// "pago / pular este mês": marca o ciclo atual pra ser pulado.
export async function pularCiclo(id: string) {
  const ag = await agendamentosRepo.buscar(id)
  if (!ag) throw new ErroHttp(404, 'Agendamento não encontrado')
  await conferirDono(ag.tenantId)
  const ref = cicloRef(ag, ymd(new Date()))
  return agendamentosRepo.atualizar(id, { pularCicloRef: ref })
}

export async function removerAgendamento(id: string) {
  const ag = await agendamentosRepo.buscar(id)
  if (!ag) throw new ErroHttp(404, 'Agendamento não encontrado')
  await conferirDono(ag.tenantId)
  await agendamentosRepo.remover(id)
  return { ok: true }
}

type AgComContato = Awaited<ReturnType<typeof agendamentosRepo.buscar>>

// Cria a missão e dispara (IA conduz) ou enfileira o texto fixo. Não lança em opt-out.
async function dispararAgendamento(ag: NonNullable<AgComContato>) {
  if (ag.contato.optOut) {
    await db.evento.create({
      data: { tenantId: ag.tenantId, tipo: 'agendamento_pulado', dados: { agendamentoId: ag.id, motivo: 'opt_out' } },
    })
    return
  }
  const base = {
    tenantId: ag.tenantId,
    contatoId: ag.contatoId,
    numeroId: ag.numeroId,
    tipo: ag.tipo,
    modo: ag.modo,
    objetivo: ag.objetivo,
    contexto: ag.contexto ?? undefined,
    criterioConclusao: ag.criterioConclusao ?? undefined,
    tom: ag.tom ?? undefined,
    informacoes: ag.informacoes ?? undefined,
  }
  if (ag.entrega === 'fixa') {
    // mensagem fixa: cria a missão com a IA pausada (humano trata respostas) e enfileira o texto
    const missao = await missoesRepo.criar({ ...base, estado: 'em_conversa', iniciadaEm: new Date(), iaPausada: true })
    await filaRepo.enfileirar({
      tenantId: ag.tenantId,
      missaoId: missao.id,
      contatoId: ag.contatoId,
      payload: { numeroId: ag.numeroId, telefone: ag.contato.telefone, texto: ag.mensagemFixa ?? ag.objetivo, tipo: 'novo' },
      agendadoPara: new Date(Date.now() + jitterMs('novo')),
    })
    await db.evento.create({
      data: { tenantId: ag.tenantId, missaoId: missao.id, tipo: 'agendamento_disparado', dados: { agendamentoId: ag.id, entrega: 'fixa' } },
    })
  } else {
    const missao = await missoesRepo.criar({ ...base, estado: 'na_fila', iniciadaEm: new Date() })
    await db.evento.create({
      data: { tenantId: ag.tenantId, missaoId: missao.id, tipo: 'agendamento_disparado', dados: { agendamentoId: ag.id, entrega: 'ia' } },
    })
    try {
      await processarTurno(missao.id) // gera o opener + enfileira (fila respeita janela/anti-ban)
    } catch (e) {
      console.error('[agendamento] processarTurno falhou:', e)
    }
  }
}

// Agendador: percorre os agendamentos ativos e dispara os que "vencem hoje".
export async function processarDevidos(agora = new Date()) {
  const hoje = ymd(agora)
  const ativos = await agendamentosRepo.ativos()
  for (const ag of ativos) {
    if (!ehDiaDeDisparo(ag, hoje)) continue
    const ref = cicloRef(ag, hoje)
    if (ag.ultimoCicloRef === ref) continue // idempotência: já disparou este ciclo
    if (ag.pularCicloRef === ref) {
      // pago/pulado neste ciclo → consome o ciclo sem disparar
      await agendamentosRepo.marcarDisparado(ag.id, ref, agora)
      continue
    }
    try {
      await dispararAgendamento(ag)
    } catch (e) {
      console.error('[agendamento] disparo falhou', ag.id, e)
      continue // não marca → tenta de novo no próximo tick
    }
    await agendamentosRepo.marcarDisparado(ag.id, ref, agora)
    if (ag.recorrencia === 'uma_vez') await agendamentosRepo.desativar(ag.id)
  }
}

// disparo manual (botão "disparar agora" / teste) — respeita dono.
export async function dispararAgora(id: string) {
  const ag = await agendamentosRepo.buscar(id)
  if (!ag) throw new ErroHttp(404, 'Agendamento não encontrado')
  await conferirDono(ag.tenantId)
  await dispararAgendamento(ag)
  await agendamentosRepo.marcarDisparado(ag.id, cicloRef(ag, ymd(new Date())), new Date())
  if (ag.recorrencia === 'uma_vez') await agendamentosRepo.desativar(ag.id)
  return { ok: true }
}
