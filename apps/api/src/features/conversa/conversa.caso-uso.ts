// ⚙️ Aplicação — o HARNESS da conversa (a moldura determinística em volta do LLM).
// 1 turno: monta contexto → IA (structured) → valida → aplica estado + fatos → responde.
import { config } from '../../core/config'
import { conferirDono } from '../../core/contexto'
import { db } from '../../core/db'
import { whatsapp } from '../../core/evolution'
import { ErroHttp } from '../../core/erros'
import { ia } from '../../core/ia'
import { SaidaIASchema, type SaidaIA, type UsoIA } from '../../core/ia/porta-ia'
import { telefoneBR } from '../../core/telefone'
import { conhecimentoRelevante } from '../conhecimento/conhecimento.caso-uso'
import { conhecimentoRepo } from '../conhecimento/conhecimento.repo'
import { jitterMs } from '../fila/fila.dominio'
import { filaRepo } from '../fila/fila.repo'
import { midiaParaEnvio, midiasDoTenant } from '../midia/midia.caso-uso'
import { montarFicha } from '../memoria/memoria.montador'
import { podeTransicionar } from '../missoes/missao.dominio'
import { missoesRepo } from '../missoes/missoes.repo'
import { lerRoteiro, lerEstado, avancar } from '../roteiro/roteiro.dominio'
import { lerEstilo } from '../tenant/tenant.estilo'
import { conversaRepo } from './conversa.repo'

// período do dia no fuso do tenant → a IA cumprimenta certo (bom dia/tarde/noite)
function periodoDoDia(agora: Date): 'manhã' | 'tarde' | 'noite' {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: config.tz, hour: 'numeric', hourCycle: 'h23' }).format(agora),
  )
  if (h < 12) return 'manhã'
  if (h < 18) return 'tarde'
  return 'noite'
}

const turnosAtivos = new Set<string>()

// Wrapper com LOCK por missão (processo único): evita dois turnos concorrentes para
// a mesma missão — ex.: o lead manda 2 mensagens seguidas — que gerariam resposta dupla.
export async function processarTurno(missaoId: string) {
  if (turnosAtivos.has(missaoId)) {
    // já há um turno rodando (ex.: IA lenta e o lead mandou outra mensagem). NÃO descarta:
    // re-agenda pela janela de debounce — quando o turno atual terminar, o próximo roda e
    // já lê a mensagem nova no histórico. Sem isso, a mensagem ficaria sem resposta.
    agendarTurno(missaoId)
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

// Instrumentação de custo (só super-admin vê): acumula os tokens de uma chamada ao provedor
// na missão, de forma atômica (increment) e best-effort — um erro de DB aqui não pode
// derrubar o turno. O dublê não reporta uso (uso === undefined) → nada a fazer.
function registrarUso(missaoId: string, uso?: UsoIA) {
  if (!uso) return
  void db.missao
    .update({
      where: { id: missaoId },
      data: {
        tokensEntrada: { increment: uso.entrada },
        tokensSaida: { increment: uso.saida },
      },
    })
    .catch((err) => console.error('[custo] incremento de tokens falhou:', err))
}

// Anti-rajada do aviso de escalonamento: numa queda da OpenAI, TODAS as missões ativas
// escalam de uma vez → seria uma rajada de self-sends direto no chip (fora da fila anti-ban).
// Este throttle por instância coalesce a rajada (1 aviso / janela); o operador ainda vê tudo
// no inbox de Escalados (fonte da verdade). [P2-4] Ideal futuro: item de fila com destino próprio.
const ultimoAvisoPorInstancia = new Map<string, number>()
const JANELA_AVISO_MS = 20_000

// Avisa o operador no WhatsApp quando uma conversa escala (reusa o self-send validado:
// o número entrega mensagem pra ele mesmo). Best-effort — NUNCA derruba o turno.
// Destino = numeroAviso configurado, senão o próprio número (self-send funciona). Normaliza com o
// DDI 55 (telefoneBR): sem o 55 o JID fica inválido (exists:false) e o aviso não sai.
async function avisarEscalonamento(
  missao: {
    id: string
    tenantId: string
    numero: {
      avisarEscalonamento: boolean
      numeroAviso: string | null
      telefone: string
      instanciaEvolution: string
    }
    contato: { nome: string | null; telefone: string }
  },
  motivo?: string | null,
) {
  const n = missao.numero
  if (!n?.avisarEscalonamento) return
  const destino = telefoneBR(n.numeroAviso || n.telefone || '')
  if (destino.length < 10) return
  // anti-rajada: numa queda de IA em massa, não dispara N self-sends seguidos no mesmo chip
  const agora = Date.now()
  if (agora - (ultimoAvisoPorInstancia.get(n.instanciaEvolution) ?? 0) < JANELA_AVISO_MS) return
  ultimoAvisoPorInstancia.set(n.instanciaEvolution, agora)
  const quem = missao.contato?.nome
    ? `${missao.contato.nome} (+${missao.contato.telefone})`
    : `+${missao.contato?.telefone ?? '?'}`
  try {
    await whatsapp.enviarTexto(
      n.instanciaEvolution,
      destino,
      `🔔 Conversa escalada — ${quem} precisa de você.\nMotivo: ${motivo || 'atendimento humano'}.\nAbra o painel pra assumir.`,
    )
    await db.evento.create({
      data: { tenantId: missao.tenantId, missaoId: missao.id, tipo: 'aviso_escalonamento', dados: { destino } },
    })
  } catch (e) {
    console.error('[aviso-escalonamento] falhou (ignorado):', (e as Error)?.message)
  }
}

async function executarTurno(missaoId: string) {
  const missao = await missoesRepo.buscar(missaoId)
  if (!missao) return { ok: false as const, motivo: 'missao_inexistente' }

  // 0) guardrail de controle: se um humano assumiu (IA pausada) OU a campanha está pausada, a IA
  // não responde/gera (o inbound já foi salvo → histórico preservado; retoma ao despausar).
  if (missao.iaPausada || missao.campanha?.pausada) return { ok: true as const, pausada: true }

  // 1) monta a ficha: contexto individual (missão + contato) + memória COLETIVA.
  // RAG: recupera só os trechos RELEVANTES do conhecimento (as últimas mensagens do lead
  // como consulta) — corta custo/escala. conhecimentoRelevante NUNCA lança e SEMPRE devolve
  // algo utilizável (degrada p/ todo o conhecimento aprovado se o RAG estiver indisponível).
  const consulta = missao.mensagens
    .filter((m) => m.direcao === 'in')
    .slice(-3)
    .map((m) => m.conteudo)
    .join(' ')
  const conhecimento = await conhecimentoRelevante(missao.tenantId, consulta)
  // biblioteca disponível à IA (herança ao vivo, igual ao DNA): mídias da MISSÃO vencem; se ela não
  // curou nada, herda as da CAMPANHA; se nenhuma das duas curou, toda a biblioteca fica à disposição.
  const biblioteca = await midiasDoTenant(missao.tenantId)
  const idsCurados = missao.midiaIds.length ? missao.midiaIds : (missao.campanha?.midiaIds ?? [])
  const midias = idsCurados.length
    ? biblioteca.filter((m) => idsCurados.includes(m.id))
    : biblioteca
  // SINAIS de conversa humana (fix "não parecer robô"): período do dia (saudação certa) +
  // se já houve troca com este contato (nesta ou em missão anterior → não recomeçar com "bom dia").
  const jaConversouAntes =
    missao.mensagens.some((m) => m.direcao === 'out') ||
    (await conversaRepo.contatoJaContatado(missao.contatoId, missao.id))
  const ctx = montarFicha(missao, conhecimento, midias, {
    periodo: periodoDoDia(new Date()),
    jaConversouAntes,
  })

  // 2) chama a IA e 3) VALIDA o contrato (guardrail — nunca confia cego no modelo).
  // Se a IA falhar (ex.: OpenAI 401/429), NÃO some em silêncio: registra o erro,
  // escala pra um humano (aparece no inbox de Escalados) e para.
  let saida: SaidaIA
  try {
    const r = await ia.gerar(ctx)
    saida = SaidaIASchema.parse(r.saida)
    registrarUso(missaoId, r.uso)
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
    await avisarEscalonamento(missao, 'Falha na IA — precisa de um humano')
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
    await avisarEscalonamento(missao, saida.motivo_escala)
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
      const { texto, uso } = await ia.resumir(ctx)
      registrarUso(missaoId, uso)
      await conversaRepo.salvarResumo(missaoId, texto)
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

  // 6a) MODO ROTEIRO (§FactoryHub): a IA executou o passo atual neste turno → avança o ponteiro
  // da sequência (determinístico). Só no fluxo automático: escalada/copilot já retornaram acima
  // sem avançar (o passo não foi cumprido). Nada acontece se a campanha não tem roteiro.
  const roteiroDef = lerRoteiro(missao.campanha?.roteiro)
  if (roteiroDef) {
    const estadoRoteiro = lerEstado(missao.roteiroEstado)
    const ultimaEntrada = [...missao.mensagens].reverse().find((m) => m.direcao === 'in')?.conteudo ?? null
    const proximo = avancar(roteiroDef, estadoRoteiro, {
      fatos: { ...(ctx.fatos ?? {}), ...(saida.fatos_novos ?? {}) },
      opcaoRoteiro: saida.opcao_roteiro,
      textoCliente: ultimaEntrada, // fallback: casa a opção pelo texto se a IA não preencher opcao_roteiro
    })
    if (proximo.ramo !== estadoRoteiro.ramo || proximo.idx !== estadoRoteiro.idx) {
      await conversaRepo.salvarRoteiroEstado(missaoId, proximo)
    }
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
  // 'novo' (opener) = NÓS abrindo uma conversa FRIA — missão sem NENHUM inbound do lead.
  // Se o lead já mandou algo (há inbound), nossa saída é RESPOSTA ('conversa'), mesmo sendo a
  // 1ª saída (ex.: suporte reativo). Só opener frio entra no gate de budget/janela de outreach;
  // resposta a cliente engajado sempre flui. (Antes: checava ausência de OUT → 1ª resposta virava
  // 'novo' e o budget diário travava a resposta ao cliente — foi o bug do Desbravando.)
  const ehOpener = !missao.mensagens.some((m) => m.direcao === 'in')
  const tipo = ehOpener ? 'novo' : 'conversa'
  // estilo da missão (fallback: tenant) → se "bolhas" ligado, o executor quebra a resposta
  // em 2-3 mensagens curtas (ritmo humano da demo). Continua UM item de fila (anti-rajada ok).
  const estilo = lerEstilo(missao.estilo ?? missao.tenant?.estilo)
  try {
    await filaRepo.enfileirar({
      tenantId: missao.tenantId,
      missaoId,
      contatoId: missao.contatoId,
      payload: {
        numeroId: missao.numeroId,
        telefone: missao.contato.telefone,
        texto: saida.resposta,
        tipo,
        bolhas: estilo.bolhas,
      },
      agendadoPara: new Date(Date.now() + jitterMs(tipo)),
    })
  } catch (e) {
    // a IA GEROU a resposta mas não deu pra enfileirar (DB/etc.) → NÃO deixa sumir: escala pro humano.
    console.error('[conversa] enfileirar falhou → escalando:', (e as Error)?.message)
    const pausa = { iaPausada: true, motivoEscala: 'Falha ao enfileirar a resposta — precisa de um humano' }
    if (podeTransicionar(missao.estado, 'escalada')) {
      await missoesRepo.atualizarEstado(missaoId, 'escalada', pausa)
    } else {
      await missoesRepo.atualizar(missaoId, pausa)
    }
    await avisarEscalonamento(missao, 'Falha ao enfileirar a resposta gerada')
    return { ok: false as const, erro_enfileirar: true }
  }
  // 7b) MÍDIA: se a IA decidiu enviar um arquivo da biblioteca, enfileira LOGO APÓS o texto.
  // Best-effort: nunca derruba o turno (a mensagem já foi enfileirada); só envia mídia do próprio tenant.
  if (saida.enviar_midia) {
    try {
      // trava DETERMINÍSTICA (não confia só no prompt): não reenvia a MESMA mídia nesta missão
      const enviadas = await db.evento.findMany({ where: { missaoId, tipo: 'midia_enviada' }, select: { dados: true } })
      const jaMandou = enviadas.some((e) => (e.dados as { midiaId?: string } | null)?.midiaId === saida.enviar_midia)
      const doc = jaMandou ? null : await midiaParaEnvio(saida.enviar_midia, missao.tenantId)
      if (doc) {
        await filaRepo.enfileirar({
          tenantId: missao.tenantId,
          missaoId,
          contatoId: missao.contatoId,
          // MESMO `tipo` do texto: num opener frio a mídia também passa pelo gate de janela/budget (anti-ban)
          payload: { numeroId: missao.numeroId, telefone: missao.contato.telefone, documento: doc, tipo },
          agendadoPara: new Date(Date.now() + jitterMs(tipo) + 4000), // chega logo depois da mensagem
        })
        await db.evento.create({ data: { tenantId: missao.tenantId, missaoId, tipo: 'midia_enviada', dados: { midiaId: saida.enviar_midia } } })
      }
    } catch (e) {
      console.error('[conversa] enfileirar mídia falhou (best-effort):', (e as Error)?.message)
    }
  }
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
  // OTIMIZAÇÃO DE CUSTO (COST-2): o resumo NÃO precisa rodar todo turno — o harness
  // já injeta as últimas 8 mensagens cruas, então nos primeiros turnos o resumo é
  // redundante. Resumimos a cada N turnos (ou ao concluir), cortando ~1/3 do custo.
  // (A escalada tem seu próprio resumo fresco no passo 5, pro handoff humano.)
  const RESUMIR_CADA = 3
  const turnoAtual = missao.mensagens.filter((mm) => mm.direcao === 'out').length + 1
  const deveResumir = turnoAtual % RESUMIR_CADA === 0 || saida.novo_estado === 'concluida'
  if (deveResumir) {
    // Best-effort: a resposta JÁ foi enfileirada (passo 7); um erro transitório do
    // provedor aqui não pode virar 500 no painel (ex.: no caminho síncrono do iniciar).
    try {
      const { texto, uso } = await ia.resumir({
        ...ctx,
        ultimasMensagens: [
          ...ctx.ultimasMensagens,
          { direcao: 'out', conteudo: saida.resposta },
        ],
      })
      registrarUso(missaoId, uso)
      await conversaRepo.salvarResumo(missaoId, texto)
    } catch (e) {
      console.error('[conversa] resumir falhou (ignorado):', e)
    }
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
