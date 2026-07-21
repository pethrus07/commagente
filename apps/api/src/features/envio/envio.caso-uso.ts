// ⚙️ Aplicação — executor de envio (Fatia 2, envio DIRETO).
// A fila anti-bloqueio (budget, janela, jitter, cap) vem inteira na Fatia 6;
// aqui já entra a "digitação simulada" (presença) por ser barata e importante.
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
) {
  const numero = await envioRepo.buscarNumero(numeroId)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  const instancia = numero.instanciaEvolution

  // sinaliza "digitando…" e espera esse tempo antes de mandar
  const ms = msDigitando(texto)
  await wa.enviarPresenca(instancia, telefone, 'composing', ms)
  await new Promise((r) => setTimeout(r, ms))

  const { providerMsgId } = await wa.enviarTexto(instancia, telefone, texto)

  await envioRepo.registrarEvento(numero.tenantId, 'mensagem_enviada', {
    telefone,
    conteudo: texto,
    providerMsgId,
  })
  return { providerMsgId, telefone, digitou_ms: ms }
}
