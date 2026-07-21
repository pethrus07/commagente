// ⚙️ Aplicação — executor de envio (envio DIRETO; fila anti-bloqueio vem na Fatia 6).
// Já entra a "digitação simulada" (presença) e a gravação em `mensagens`.
import { ErroHttp } from '../../core/erros'
import { evolutionClient } from '../../core/evolution/evolution.client'
import type { PortaWhatsApp } from '../../core/evolution/porta-whatsapp'
import { envioRepo } from './envio.repo'

const wa: PortaWhatsApp = evolutionClient

// tempo de "digitando…" proporcional ao texto, limitado (ritmo humano)
function msDigitando(texto: string): number {
  const ms = texto.length * 60 // ~60ms por caractere
  return Math.min(Math.max(ms, 800), 6000) // entre 0,8s e 6s
}

export async function enviarTexto(
  numeroId: string,
  telefone: string,
  texto: string,
  missaoId?: string,
) {
  const numero = await envioRepo.buscarNumero(numeroId)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  const instancia = numero.instanciaEvolution

  const contato = await envioRepo.upsertContato(numero.tenantId, telefone)

  // sinaliza "digitando…" e espera esse tempo antes de mandar
  const ms = msDigitando(texto)
  await wa.enviarPresenca(instancia, telefone, 'composing', ms)
  await new Promise((r) => setTimeout(r, ms))

  const { providerMsgId } = await wa.enviarTexto(instancia, telefone, texto)

  await envioRepo.gravarMensagemSaida({
    tenantId: numero.tenantId,
    missaoId: missaoId ?? null,
    contatoId: contato.id,
    conteudo: texto,
    providerMsgId,
    statusEnvio: 'enviando', // vira 'ok' quando o status de entrega chegar no webhook
  })
  return { providerMsgId, telefone, digitou_ms: ms, missaoId: missaoId ?? null }
}
