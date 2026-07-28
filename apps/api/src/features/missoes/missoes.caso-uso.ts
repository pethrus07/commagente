// ⚙️ Aplicação — casos de uso de missão.
import type { EstadoMissao, Prisma } from '@prisma/client'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { conferirDono, contexto, tenantAtual } from '../../core/contexto'
import { processarTurno } from '../conversa/conversa.caso-uso'
import { classificarSaude } from '../numeros/numeros.dominio'
import { numerosRepo } from '../numeros/numeros.repo'
import { resolverContatosDaTag } from '../tags/tags.caso-uso'
import { validarTransicao } from './missao.dominio'
import { missoesRepo } from './missoes.repo'

type DadosMissao = {
  numeroId: string
  tipo?: string
  modo?: string
  objetivo: string
  contexto?: string
  criterioConclusao?: string
  tom?: string
  informacoes?: string
  campanhaId?: string
}

// Disparo em LOTE: a MESMA definição de missão → N contatos. Cada contato vira
// uma missão própria (conversa independente, com memória e estado próprios).
export async function criarMissaoEmLote(
  input: DadosMissao & {
    contatos?: { telefone: string; nome?: string }[]
    tagId?: string // alvo por segmento: resolve TODOS os contatos da tag no servidor
  },
  origem = 'lote',
) {
  const tenantId = await tenantAtual()

  const numero = await db.numeroWhatsapp.findUnique({
    where: { id: input.numeroId },
  })
  if (!numero || numero.tenantId !== tenantId) {
    throw new ErroHttp(404, 'Número não encontrado')
  }

  // audiência = contatos avulsos + (se veio tagId) todos os contatos da tag; dedup por telefone
  const daTag = input.tagId ? await resolverContatosDaTag(input.tagId) : []
  const vistos = new Set<string>()
  const alvo = [...(input.contatos ?? []), ...daTag].filter((c) => {
    const t = c.telefone.replace(/\D/g, '')
    if (t.length < 8 || vistos.has(t)) return false
    vistos.add(t)
    return true
  })
  if (!alvo.length)
    throw new ErroHttp(400, 'Informe ao menos um contato (avulso ou por tag).')

  const missoes = []
  for (const c of alvo) {
    const telefone = c.telefone.replace(/\D/g, '')
    if (telefone.length < 8) continue // pula linhas inválidas do lote

    const contato = await db.contato.upsert({
      where: { tenantId_telefone: { tenantId, telefone } },
      update: c.nome ? { nome: c.nome } : {},
      // opt-in registrado na criação manual/lote (operador declara ter consentimento)
      create: { tenantId, telefone, nome: c.nome, origem, optInEm: new Date(), optInOrigem: origem },
    })

    // respeita opt-out também no caminho AVULSO (a tag já exclui na origem): um contato
    // que já pediu pra não receber não vira missão-fantasma. LGPD + coerência.
    if (contato.optOut) continue

    const missao = await missoesRepo.criar({
      tenantId,
      contatoId: contato.id,
      numeroId: input.numeroId,
      tipo: input.tipo,
      modo: input.modo,
      objetivo: input.objetivo,
      contexto: input.contexto,
      criterioConclusao: input.criterioConclusao,
      tom: input.tom,
      informacoes: input.informacoes,
      campanhaId: input.campanhaId,
    })
    await db.evento.create({
      data: {
        tenantId,
        missaoId: missao.id,
        tipo: 'missao_criada',
        dados: { objetivo: input.objetivo, contatoId: contato.id, origem },
      },
    })
    missoes.push(missao)
  }

  if (!missoes.length)
    throw new ErroHttp(400, 'Nenhum contato válido no lote')
  return { criadas: missoes.length, missoes }
}

// Criação individual — atalho sobre o lote (1 contato).
export async function criarMissao(
  input: DadosMissao & { telefone: string; nomeContato?: string },
) {
  const { missoes } = await criarMissaoEmLote(
    { ...input, contatos: [{ telefone: input.telefone, nome: input.nomeContato }] },
    'manual',
  )
  return missoes[0]
}

// COST-1: o custo (tokens) é visível SÓ para super-admin. O gate não pode ser só no
// painel — sem isto os campos vazariam no JSON da API para admins do tenant (e, num
// produto white-label, o custo é informação confidencial da plataforma).
function ocultarCustoSeNaoSuper<T extends { tokensEntrada: number; tokensSaida: number }>(
  m: T,
): T {
  if (contexto.atual()?.papel === 'super_admin') return m
  return { ...m, tokensEntrada: 0, tokensSaida: 0 }
}

export async function listarMissoes() {
  const tenantId = await tenantAtual()
  const missoes = await missoesRepo.listar(tenantId)
  return missoes.map(ocultarCustoSeNaoSuper)
}

// Inbox de escalados — missões que a IA entregou pra um humano.
export async function listarEscalados() {
  const tenantId = await tenantAtual()
  return missoesRepo.listarEscalados(tenantId)
}

// Humano assume a conversa: tira do inbox (escalada → em_conversa) mas mantém a
// IA pausada — quem responde agora é a pessoa, pelo painel.
export async function assumirConversa(id: string) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)

  const extra: Prisma.MissaoUpdateInput = { iaPausada: true }
  if (missao.estado === 'escalada') {
    extra.estado = 'em_conversa'
    if (!missao.iniciadaEm) extra.iniciadaEm = new Date()
  }
  const atualizada = await missoesRepo.atualizar(id, extra)
  await db.evento.create({
    data: { tenantId: missao.tenantId, missaoId: id, tipo: 'humano_assumiu' },
  })
  return atualizada
}

// Devolve a conversa para a IA (ela volta a responder na próxima mensagem do lead).
export async function devolverParaIa(id: string) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)

  const atualizada = await missoesRepo.atualizar(id, { iaPausada: false })
  await db.evento.create({
    data: { tenantId: missao.tenantId, missaoId: id, tipo: 'devolvida_ia' },
  })
  return atualizada
}

export async function obterMissao(id: string) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)
  return ocultarCustoSeNaoSuper(missao)
}

// Edita a config da missão (objetivo/contexto/tom/informações) — reflete no próximo turno.
// O nome do contato é atualizado à parte (mora em Contato).
export async function editarMissao(
  id: string,
  patch: {
    tipo?: string
    modo?: string
    objetivo?: string
    contexto?: string | null
    criterioConclusao?: string | null
    tom?: string | null
    informacoes?: string | null
    nomeContato?: string
  },
) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)

  const dados: Prisma.MissaoUpdateInput = {}
  if (patch.tipo !== undefined) dados.tipo = patch.tipo
  if (patch.modo !== undefined) dados.modo = patch.modo
  if (patch.objetivo !== undefined) dados.objetivo = patch.objetivo
  if (patch.contexto !== undefined) dados.contexto = patch.contexto
  if (patch.criterioConclusao !== undefined) dados.criterioConclusao = patch.criterioConclusao
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
  await conferirDono(missao.tenantId)

  // idempotência: só inicia uma vez. Sem isto, um 2º clique (estado já na_fila)
  // pula os guardas e enfileira OUTRA abertura → o lead recebe 2 mensagens.
  if (missao.estado !== 'configurada') {
    throw new ErroHttp(409, 'Missão já iniciada.')
  }

  // opt-out: respeita quem pediu pra não receber
  if (missao.contato.optOut) {
    throw new ErroHttp(409, 'Este contato pediu pra não receber mensagens (opt-out).')
  }

  // cap anti-bloqueio: limita conversas simultâneas conduzidas pela IA no número
  if (missao.estado === 'configurada') {
    const ativas = await numerosRepo.contarAtivas(missao.numeroId)
    if (ativas >= missao.numero.maxConversasAtivas) {
      throw new ErroHttp(
        409,
        `Cap de conversas ativas atingido (${missao.numero.maxConversasAtivas}) neste número. Conclua ou arquive alguma antes de iniciar outra.`,
      )
    }

    // anti-spam: no máx. 2 iniciações por contato por semana (evita parecer spam)
    const semanaAtras = new Date(Date.now() - 7 * 86_400_000)
    const iniciadasContato = await missoesRepo.contarIniciadasPorContato(missao.contatoId, semanaAtras)
    if (iniciadasContato >= 2) {
      throw new ErroHttp(
        409,
        'Limite de iniciações por contato atingido (2 por semana). Espaça o contato pra não parecer spam.',
      )
    }

    // saúde anti-ban (gatilho 2026): taxa de resposta em risco → pausa novas iniciações
    const { base, naoRespondidas } = await numerosRepo.saude(missao.numeroId)
    const saude = classificarSaude(base, naoRespondidas)
    if (saude.status === 'risco') {
      throw new ErroHttp(
        409,
        `Número com taxa de resposta baixa (${Math.round((saude.replyRate ?? 0) * 100)}%). ` +
          'Novas iniciações pausadas pra proteger de bloqueio — conclua ou arquive os leads sem retorno antes.',
      )
    }

    await missoesRepo.atualizarEstado(id, 'na_fila')
  }
  await processarTurno(id) // gera opener via IA + enfileira; worker envia
  return { ok: true, iniciada: true }
}

// Início em LOTE (o "Disparar campanha / iniciar todas"): inicia todas as missões
// `configurada` informadas, PULANDO (sem falhar o lote) as que esbarram nos guardas
// anti-bloqueio, e devolve um relatório do que iniciou e do que ficou de fora e por quê.
// Cada início gera só o opener na fila — o worker anti-ban espaça os envios (não sai rajada).
export async function iniciarMissoesConfiguradas(ids: string[]) {
  const puladas: Record<string, number> = {}
  const pula = (motivo: string) => {
    puladas[motivo] = (puladas[motivo] ?? 0) + 1
  }
  let iniciadas = 0

  // caches por número — evita N queries de saúde/cap num lote grande
  const emRisco = new Map<string, boolean>()
  const vagas = new Map<string, number>() // cap de conversas ativas restante no número

  for (const id of ids) {
    try {
      const missao = await missoesRepo.buscar(id)
      if (!missao) {
        pula('inexistente')
        continue
      }
      // cross-tenant cai no MESMO balde de "inexistente" (não revela IDs de outro tenant)
      try {
        await conferirDono(missao.tenantId)
      } catch {
        pula('inexistente')
        continue
      }
      if (missao.estado !== 'configurada') {
        pula('ja_iniciada')
        continue
      }
      if (missao.contato.optOut) {
        pula('opt_out')
        continue
      }

      // saúde do número (cache): em risco → pausa novas iniciações (gatilho anti-ban)
      if (!emRisco.has(missao.numeroId)) {
        const { base, naoRespondidas } = await numerosRepo.saude(missao.numeroId)
        emRisco.set(missao.numeroId, classificarSaude(base, naoRespondidas).status === 'risco')
      }
      if (emRisco.get(missao.numeroId)) {
        pula('saude_risco')
        continue
      }

      // cap de conversas ativas do número (cache decrementado a cada início)
      if (!vagas.has(missao.numeroId)) {
        const ativas = await numerosRepo.contarAtivas(missao.numeroId)
        vagas.set(missao.numeroId, Math.max(0, missao.numero.maxConversasAtivas - ativas))
      }
      if ((vagas.get(missao.numeroId) ?? 0) <= 0) {
        pula('cap_ativas')
        continue
      }

      // anti-spam: no máx. 2 iniciações por contato por semana
      const semana = new Date(Date.now() - 7 * 86_400_000)
      if ((await missoesRepo.contarIniciadasPorContato(missao.contatoId, semana)) >= 2) {
        pula('cap_contato')
        continue
      }

      // inicia: move p/ na_fila e consome a vaga JÁ (antes do turno), pra o cap não furar.
      // Se o turno falhar, reverte pra 'configurada' (não deixa missão órfã em na_fila
      // sem opener) e devolve a vaga.
      await missoesRepo.atualizarEstado(id, 'na_fila')
      vagas.set(missao.numeroId, (vagas.get(missao.numeroId) ?? 1) - 1)
      try {
        await processarTurno(id) // gera opener via IA + enfileira; worker envia
      } catch (e) {
        await missoesRepo.atualizarEstado(id, 'configurada').catch(() => {})
        vagas.set(missao.numeroId, (vagas.get(missao.numeroId) ?? 0) + 1)
        throw e // cai no catch externo → conta como 'erro'
      }
      iniciadas++
    } catch (e) {
      console.error('[iniciar-lote] falhou a missão', id, e)
      pula('erro')
    }
  }
  return { iniciadas, total: ids.length, puladas }
}

export async function mudarEstado(id: string, novoEstado: EstadoMissao) {
  const missao = await missoesRepo.buscar(id)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)

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
