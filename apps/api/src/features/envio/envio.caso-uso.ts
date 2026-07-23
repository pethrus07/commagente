// ⚙️ Aplicação — executor de envio (envio DIRETO; fila anti-bloqueio vem na Fatia 6).
// Já entra a "digitação simulada" (presença) e a gravação em `mensagens`.
import { conferirDono } from '../../core/contexto'
import { ErroHttp } from '../../core/erros'
import { whatsapp } from '../../core/evolution'
import type { PortaWhatsApp } from '../../core/evolution/porta-whatsapp'
import { envioRepo } from './envio.repo'

const wa: PortaWhatsApp = whatsapp

// Envio MANUAL (rota /envio): valida que o número é do tenant da requisição.
// O worker usa enviarTexto direto (sem contexto de request → sem esse check).
export async function enviarTextoManual(
  numeroId: string,
  telefone: string,
  texto: string,
  missaoId?: string,
) {
  const numero = await envioRepo.buscarNumero(numeroId)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  await conferirDono(numero.tenantId)
  return enviarTexto(numeroId, telefone, texto, missaoId)
}

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

// Envia um documento (ex.: PDF do evento) e registra em `mensagens` (direção out).
export async function enviarDocumento(
  numeroId: string,
  telefone: string,
  doc: { base64: string; nomeArquivo: string; mimetype?: string; legenda?: string },
  missaoId?: string,
) {
  const numero = await envioRepo.buscarNumero(numeroId)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  const contato = await envioRepo.upsertContato(numero.tenantId, telefone)

  const { providerMsgId } = await wa.enviarDocumento(numero.instanciaEvolution, telefone, doc)

  await envioRepo.gravarMensagemSaida({
    tenantId: numero.tenantId,
    missaoId: missaoId ?? null,
    contatoId: contato.id,
    conteudo: doc.legenda ? `📎 ${doc.nomeArquivo} — ${doc.legenda}` : `📎 ${doc.nomeArquivo}`,
    providerMsgId,
    statusEnvio: 'enviando',
  })
  return { providerMsgId }
}
