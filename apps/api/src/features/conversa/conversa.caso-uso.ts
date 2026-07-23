// ⚙️ Aplicação — o HARNESS da conversa (a moldura determinística em volta do LLM).
// 1 turno: monta contexto → IA (structured) → valida → aplica estado + fatos → responde.
import { conferirDono } from '../../core/contexto'
import { db } from '../../core/db'
import { ErroHttp } from '../../core/erros'
import { ia } from '../../core/ia'
import { SaidaIASchema, type SaidaIA } from '../../core/ia/porta-ia'
import { conhecimentoRepo } from '../conhecimento/conhecimento.repo'
import { jitterMs } from '../fila/fila.dominio'
import { filaRepo } from '../fila/fila.repo'
import { montarFicha } from '../memoria/memoria.montador'
import { podeTransicionar } from '../missoes/missao.dominio'
import { missoesRepo } from '../missoes/missoes.repo'
import { conversaRepo } from './conversa.repo'

const turnosAtivos = new Set<string>()

// Wrapper com LOCK por missão (processo único): evita dois turnos concorrentes para
// a mesma missão — ex.: o lead manda 2 mensagens seguidas — que gerariam resposta dupla.
export async function processarTurno(missaoId: string) {
  if (turnosAtivos.has(missaoId)) {
    return { ok: true as const, ignorado: 'turno_em_andamento' as const }
  }
  turnosAtivos.add(missaoId)
  try {
    return await executarTurno(missaoId)
  } finally {
    turnosAtivos.delete(missaoId)
  }
}

// Debounce anti-duplo-texto: o webhook agenda o turno em vez de disparar na hora.
// Se o lead manda várias mensagens seguidas, elas se ACUMULAM (cada uma reinicia a
// janela) e viram UM ÚNICO turno — a IA responde tudo de uma vez, sem duplicar.
const turnosAgendados = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 7000

export function agendarTurno(missaoId: string, delayMs = DEBOUNCE_MS) {
  const anterior = turnosAgendados.get(missaoId)
  if (anterior) clearTimeout(anterior)
  const t = setTimeout(() => {
    turnosAgendados.delete(missaoId)
    processarTurno(missaoId).catch((err) =>
      console.error('[conversa] turno agendado falhou:', err),
    )
  }, delayMs)
  turnosAgendados.set(missaoId, t)
}

async function executarTurno(missaoId: string) {
  const missao = await missoesRepo.buscar(missaoId)
  if (!missao) return { ok: false as const, motivo: 'missao_inexistente' }

  // 0) guardrail de controle: se um humano assumiu (IA pausada), a IA não responde.
  if (missao.iaPausada) return { ok: true as const, pausada: true }

  // 1) monta a ficha: contexto individual (missão + contato) + memória COLETIVA (conhecimento aprovado)
  const aprovados = await conhecimentoRepo.aprovados(missao.tenantId)
  const conhecimento = aprovados.map((c) => `${c.titulo}: ${c.conteudo}`)
  const ctx = montarFicha(missao, conhecimento)

  // Instrumentação de custo (só super-admin vê no painel): cada chamada ao provedor
  // real reporta tokens aqui; acumulamos na missão de forma atômica e best-effort
  // (incremento no banco não pode derrubar o turno).
  ctx.coletarUso = ({ entrada, saida }) => {
    void db.missao
      .update({
        where: { id: missaoId },
        data: {
          tokensEntrada: { increment: entrada },
          tokensSaida: { increment: saida },
        },
      })
      .catch((err) => console.error('[custo] incremento de tokens falhou:', err))
  }

  // 2) chama a IA e 3) VALIDA o contrato (guardrail — nunca confia cego no modelo).
  // Se a IA falhar (ex.: OpenAI 401/429), NÃO some em silêncio: registra o erro,
  // escala pra um humano (aparece no inbox de Escalados) e para.
  let saida: SaidaIA
  try {
    saida = SaidaIASchema.parse(await ia.gerar(ctx))
  } catch (err) {
    await db.evento.create({
      data: {
        tenantId: missao.tenantId,
        missaoId,
        tipo: 'erro_ia',
        dados: { erro: String((err as Error)?.message ?? err).slice(0, 300) },
      },
    })
    const pausa = { iaPausada: true, motivoEscala: 'Falha na IA — precisa de um humano' }
    if (podeTransicionar(missao.estado, 'escalada')) {
      await missoesRepo.atualizarEstado(missaoId, 'escalada', pausa)
    } else {
      await missoesRepo.atualizar(missaoId, pausa)
    }
    return { ok: false as const, erro_ia: true }
  }

  // 4) memória: mescla fatos novos na missão E no perfil do contato (individual, persiste)
  if (saida.fatos_novos && Object.keys(saida.fatos_novos).length > 0) {
    await conversaRepo.salvarFatos(missaoId, {
      ...(ctx.fatos ?? {}),
      ...saida.fatos_novos,
    })
    await conversaRepo.mesclarMemoriaContato(missao.contatoId, saida.fatos_novos)
  }

  // 5) guardrail: precisa de humano → escala, PAUSA a IA e NÃO responde automático
  if (saida.precisa_humano) {
    const pausa = { iaPausada: true, motivoEscala: saida.motivo_escala ?? null }
    if (podeTransicionar(missao.estado, 'escalada')) {
      await missoesRepo.atualizarEstado(missaoId, 'escalada', pausa)
    } else {
      await missoesRepo.atualizar(missaoId, pausa)
    }
    await db.evento.create({
      data: {
        tenantId: missao.tenantId,
        missaoId,
        tipo: 'escalada',
        dados: { motivo: saida.motivo_escala ?? null },
      },
    })
    // NÃO deixa o cliente no vácuo: se a IA escreveu uma mensagem-ponte
    // ("deixa eu confirmar e já retorno"), envia antes de pausar pro humano.
    // Em co-pilot o humano trata a resposta, então não auto-envia.
    const ponte = saida.resposta?.trim()
    if (missao.modo !== 'copilot' && ponte) {
      await filaRepo.enfileirar({
        tenantId: missao.tenantId,
        missaoId,
        contatoId: missao.contatoId,
        payload: {
          numeroId: missao.numeroId,
          telefone: missao.contato.telefone,
          texto: ponte,
          tipo: 'conversa',
        },
        agendadoPara: new Date(Date.now() + jitterMs('conversa')),
      })
    }
    // T1-3: resumo fresco pro humano que vai assumir (inclui a última mensagem do lead)
    try {
      await conversaRepo.salvarResumo(missaoId, await ia.resumir(ctx))
    } catch {
      /* resumo é best-effort; não trava a escalada */
    }
    return { ok: true as const, escalada: true }
  }

  // 5b) CO-PILOT: em vez de enviar, guarda o rascunho pra aprovação humana e para aqui.
  // (fatos/memória já foram mesclados acima; estado só muda quando o humano aprovar/agir)
  if (missao.modo === 'copilot') {
    await conversaRepo.salvarRascunho(missaoId, saida.resposta)
    await db.evento.create({
      data: {
        tenantId: missao.tenantId,
        missaoId,
        tipo: 'rascunho',
        dados: { categoria: saida.categoria ?? null },
      },
    })
    return { ok: true as const, rascunho: true }
  }

  // 6) aplica o novo estado (se a transição for válida)
  if (
    saida.novo_estado !== missao.estado &&
    podeTransicionar(missao.estado, saida.novo_estado)
  ) {
    await missoesRepo.atualizarEstado(
      missaoId,
      saida.novo_estado,
      saida.novo_estado === 'concluida'
        ? { concluidaEm: new Date(), resultado: saida.resultado ?? undefined }
        : undefined,
    )
  }

  // 7) enfileira a resposta — o worker anti-bloqueio envia no ritmo humano
  // (janela + budget + jitter + espaçamento serial por número). Substitui o envio direto.
  // opener (1ª saída da missão) espaça mais que uma resposta dentro da conversa.
  const ehOpener = !missao.mensagens.some((m) => m.direcao === 'out')
  const tipo = ehOpener ? 'novo' : 'conversa'
  await filaRepo.enfileirar({
    tenantId: missao.tenantId,
    missaoId,
    contatoId: missao.contatoId,
    payload: {
      numeroId: missao.numeroId,
      telefone: missao.contato.telefone,
      texto: saida.resposta,
      tipo,
    },
    agendadoPara: new Date(Date.now() + jitterMs(tipo)),
  })
  await db.evento.create({
    data: {
      tenantId: missao.tenantId,
      missaoId,
      tipo: 'turno_ia',
      dados: {
        provedor: ia.nome,
        categoria: saida.categoria ?? null,
        novo_estado: saida.novo_estado,
      },
    },
  })

  // 7b) memória COLETIVA: se a IA propôs um aprendizado geral, grava como SUGESTÃO
  // (status 'sugerido' → aguarda aprovação humana antes de virar conhecimento ativo).
  const sugestao = saida.aprendizado_sugerido?.trim()
  if (sugestao && !(await conhecimentoRepo.existeConteudo(missao.tenantId, sugestao))) {
    await conhecimentoRepo.criar({
      tenantId: missao.tenantId,
      titulo: 'Sugestão da IA',
      conteudo: sugestao,
      status: 'sugerido',
      origem: 'ia',
      missaoId,
    })
  }

  // 8) atualiza o resumo rolante (inclui a resposta recém-enviada).
  // Best-effort: a resposta JÁ foi enfileirada (passo 7); um erro transitório do
  // provedor aqui não pode virar 500 no painel (ex.: no caminho síncrono do iniciar).
  try {
    const resumo = await ia.resumir({
      ...ctx,
      ultimasMensagens: [
        ...ctx.ultimasMensagens,
        { direcao: 'out', conteudo: saida.resposta },
      ],
    })
    await conversaRepo.salvarResumo(missaoId, resumo)
  } catch (e) {
    console.error('[conversa] resumir falhou (ignorado):', e)
  }

  return {
    ok: true as const,
    resposta: saida.resposta,
    novo_estado: saida.novo_estado,
    enfileirado: true,
  }
}

// Co-pilot — humano aprova o rascunho (opcionalmente editado): enfileira o envio e limpa.
export async function aprovarRascunho(missaoId: string, texto?: string) {
  const missao = await missoesRepo.buscar(missaoId)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)
  const conteudo = (texto?.trim() || missao.rascunho || '').trim()
  if (!conteudo) throw new ErroHttp(400, 'Não há rascunho para aprovar.')
  await filaRepo.enfileirar({
    tenantId: missao.tenantId,
    missaoId,
    contatoId: missao.contatoId,
    payload: {
      numeroId: missao.numeroId,
      telefone: missao.contato.telefone,
      texto: conteudo,
      tipo: 'conversa',
    },
    agendadoPara: new Date(Date.now() + jitterMs('conversa')),
  })
  await conversaRepo.limparRascunho(missaoId)
  return { ok: true as const, enviado: true }
}

export async function descartarRascunho(missaoId: string) {
  const missao = await missoesRepo.buscar(missaoId)
  if (!missao) throw new ErroHttp(404, 'Missão não encontrada')
  await conferirDono(missao.tenantId)
  await conversaRepo.limparRascunho(missaoId)
  return { ok: true as const }
}
