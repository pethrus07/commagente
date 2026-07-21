// ⚙️ Aplicação — casos de uso de conexão de número.
// Orquestra a PortaWhatsApp (adapter Evolution) + persistência; sem regra de negócio pesada.
import { config } from '../../core/config'
import { ErroHttp } from '../../core/erros'
import { evolutionClient } from '../../core/evolution/evolution.client'
import type { PortaWhatsApp, QrCode } from '../../core/evolution/porta-whatsapp'
import { garantirTenantPadrao } from '../../core/tenant'
import { numerosRepo } from './numeros.repo'

// injeta a porta (aqui, o adapter Evolution)
const wa: PortaWhatsApp = evolutionClient

export async function cadastrarNumero(telefone: string, instancia?: string) {
  const tenantId = await garantirTenantPadrao()
  const nomeInstancia = instancia ?? `zap-${telefone}`
  return numerosRepo.criar(tenantId, telefone, nomeInstancia)
}

export async function listarNumeros() {
  const tenantId = await garantirTenantPadrao()
  return numerosRepo.listar(tenantId)
}

export async function conectarNumero(id: string): Promise<QrCode> {
  const numero = await numerosRepo.buscar(id)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
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

  const status = await wa.statusConexao(numero.instanciaEvolution)
  await numerosRepo.atualizarStatus(id, status)
  return {
    id,
    telefone: numero.telefone,
    instancia: numero.instanciaEvolution,
    status,
  }
}
