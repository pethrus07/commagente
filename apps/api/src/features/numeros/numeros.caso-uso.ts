// ⚙️ Aplicação — casos de uso de conexão de número.
// Orquestra a PortaWhatsApp (adapter Evolution) + persistência; sem regra de negócio pesada.
import { config } from '../../core/config'
import { ErroHttp } from '../../core/erros'
import { whatsapp } from '../../core/evolution'
import type { PortaWhatsApp, QrCode } from '../../core/evolution/porta-whatsapp'
import { conferirDono, tenantAtual } from '../../core/contexto'
import { tetoDiarioPorEstagio } from '../fila/fila.dominio'
import { classificarSaude } from './numeros.dominio'
import { numerosRepo } from './numeros.repo'

// injeta a porta (aqui, o adapter Evolution)
const wa: PortaWhatsApp = whatsapp

export async function cadastrarNumero(telefone: string, instancia?: string) {
  const tenantId = await tenantAtual()
  const nomeInstancia = instancia ?? `zap-${telefone}`
  return numerosRepo.criar(tenantId, telefone, nomeInstancia)
}

export async function listarNumeros() {
  const tenantId = await tenantAtual()
  const numeros = await numerosRepo.listar(tenantId)
  return Promise.all(
    numeros.map(async (n) => {
      const { base, naoRespondidas } = await numerosRepo.saude(n.id)
      // teto EFETIVO do dia = o menor entre o budget e o teto do estágio de aquecimento
      const tetoEfetivo = Math.min(n.budgetDiario, tetoDiarioPorEstagio(n.aquecimentoEstagio))
      return { ...n, tetoEfetivo, saude: classificarSaude(base, naoRespondidas) }
    }),
  )
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Edita os knobs anti-bloqueio do número (janela de horário, budget diário, cap).
export async function atualizarConfigNumero(
  id: string,
  patch: {
    janelaInicio?: string
    janelaFim?: string
    budgetDiario?: number
    maxConversasAtivas?: number
    suporteReativo?: boolean
    suporteObjetivo?: string | null
    suporteTom?: string | null
    suporteInformacoes?: string | null
    suporteCriterio?: string | null
    suporteModo?: string
  },
) {
  const numero = await numerosRepo.buscar(id)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  await conferirDono(numero.tenantId)

  if (patch.janelaInicio && !HHMM.test(patch.janelaInicio))
    throw new ErroHttp(400, 'janelaInicio inválida (use HH:mm)')
  if (patch.janelaFim && !HHMM.test(patch.janelaFim))
    throw new ErroHttp(400, 'janelaFim inválida (use HH:mm)')
  if (patch.budgetDiario !== undefined && patch.budgetDiario < 1)
    throw new ErroHttp(400, 'budgetDiario deve ser ≥ 1')
  if (patch.maxConversasAtivas !== undefined && patch.maxConversasAtivas < 1)
    throw new ErroHttp(400, 'maxConversasAtivas deve ser ≥ 1')
  if (patch.suporteModo !== undefined && !['auto', 'copilot'].includes(patch.suporteModo))
    throw new ErroHttp(400, 'suporteModo inválido (auto | copilot)')

  return numerosRepo.atualizarConfig(id, patch)
}

export async function conectarNumero(id: string): Promise<QrCode> {
  const numero = await numerosRepo.buscar(id)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  await conferirDono(numero.tenantId)
  const { instanciaEvolution: instancia } = numero

  // idempotente: cria a instância (ignora se já existe) e aponta o webhook pra nós
  try {
    await wa.criarInstancia(instancia)
  } catch {
    // instância já existe → segue direto pro connect
  }
  await wa.configurarWebhook(instancia, config.webhookUrl)
  await numerosRepo.atualizarStatus(id, 'conectando')

  return wa.conectar(instancia) // { base64, codigo } — QR pra escanear
}

export async function statusNumero(id: string) {
  const numero = await numerosRepo.buscar(id)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  await conferirDono(numero.tenantId)

  const status = await wa.statusConexao(numero.instanciaEvolution)
  await numerosRepo.atualizarStatus(id, status)
  return {
    id,
    telefone: numero.telefone,
    instancia: numero.instanciaEvolution,
    status,
  }
}
