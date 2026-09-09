// ⚙️ Aplicação — o EXECUTOR: a última milha até o WhatsApp. Faz a "digitação simulada"
// (presença) antes de mandar, quebra a resposta em bolhas quando o estilo pede, envia documento
// quando é mídia, e grava a saída em `mensagens`.
// Quem chama é o WORKER DA FILA, nunca o harness direto: o ritmo é decidido em features/fila.
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

// Divide a resposta em BOLHAS (mensagens separadas) quando o estilo do tenant pede —
// o jeito humano de digitar (a IA separou por quebra de linha). Cap em 3 (o excedente
// junta na última). Sem bolhas ou linha única → uma mensagem só (comportamento atual).
function dividirBolhas(texto: string, ativo: boolean): string[] {
  if (!ativo) return [texto]
  const partes = texto.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean)
  if (partes.length <= 1) return [texto.trim() || texto]
  if (partes.length <= 3) return partes
  return [partes[0], partes[1], partes.slice(2).join(' ')]
}

export async function enviarTexto(
  numeroId: string,
  telefone: string,
  texto: string,
  missaoId?: string,
  bolhas = false,
) {
  const numero = await envioRepo.buscarNumero(numeroId)
  if (!numero) throw new ErroHttp(404, 'Número não encontrado')
  const instancia = numero.instanciaEvolution

  const contato = await envioRepo.upsertContato(numero.tenantId, telefone)

  const partes = dividirBolhas(texto, bolhas)
  let ultimoId: string | null = null
  let enviadas = 0
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i]
    // sinaliza "digitando…" e espera esse tempo antes de mandar cada bolha.
    // A presença é best-effort: a Evolution às vezes devolve 400 aqui — não pode abortar o texto.
    const ms = msDigitando(parte)
    try {
      await wa.enviarPresenca(instancia, telefone, 'composing', ms)
    } catch (e) {
      console.error('[envio] presença falhou (ignorado):', (e as Error).message.slice(0, 120))
    }
    await new Promise((r) => setTimeout(r, ms))

    try {
      const { providerMsgId } = await wa.enviarTexto(instancia, telefone, parte)
      ultimoId = providerMsgId
      await envioRepo.gravarMensagemSaida({
        tenantId: numero.tenantId,
        missaoId: missaoId ?? null,
        contatoId: contato.id,
        conteudo: parte,
        providerMsgId,
        statusEnvio: 'enviando', // vira 'ok' quando o status de entrega chegar no webhook
      })
      enviadas++
    } catch (e) {
      // 1ª bolha falhou (NADA enviado) → propaga pra retentar (sem duplicar nada).
      // Bolha POSTERIOR falhou (envio parcial) → NÃO propaga: retentar o payload todo
      // re-mandaria as bolhas já enviadas (duplicata = sinal de robô). Aceita o parcial e para.
      if (enviadas === 0) throw e
      console.error(
        `[envio] bolha ${i + 1}/${partes.length} falhou; mantém o parcial (${enviadas} enviada[s]):`,
        (e as Error)?.message,
      )
      break
    }

    // pausa curta entre bolhas (além do "digitando…") — ritmo de quem manda em sequência
    if (i < partes.length - 1) {
      await new Promise((r) => setTimeout(r, 600 + Math.floor(Math.random() * 900)))
    }
  }
  return { providerMsgId: ultimoId, telefone, bolhasEnviadas: enviadas, missaoId: missaoId ?? null }
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
