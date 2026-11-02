// 🔌 Transcrição real — OpenAI (endpoint /v1/audio/transcriptions, Whisper).
// Usa a mesma OPENAI_API_KEY da IA; troca via TRANSCRITOR_PROVIDER=openai.
import { config } from '../config.js'
import type { AudioEntrada, TranscritorAudio } from './porta-transcricao.js'

// mapeia o mimetype num nome de arquivo com extensão que o Whisper reconhece.
// notas de voz do WhatsApp chegam como audio/ogg; codecs=opus.
function nomeArquivo(mimetype?: string): string {
  const m = (mimetype ?? '').toLowerCase()
  if (m.includes('mpeg') || m.includes('mp3')) return 'audio.mp3'
  if (m.includes('mp4') || m.includes('m4a')) return 'audio.m4a'
  if (m.includes('wav')) return 'audio.wav'
  if (m.includes('webm')) return 'audio.webm'
  return 'audio.ogg' // ogg/opus (padrão do WhatsApp)
}

export const transcritorOpenai: TranscritorAudio = {
  nome: 'openai',

  async transcrever(audio: AudioEntrada): Promise<string> {
    if (!audio.base64) return ''
    const bytes = new Uint8Array(Buffer.from(audio.base64, 'base64'))
    const blob = new Blob([bytes], { type: audio.mimetype ?? 'audio/ogg' })

    const form = new FormData()
    form.append('file', blob, nomeArquivo(audio.mimetype))
    form.append('model', config.transcritorModelo)
    if (config.transcritorIdioma) form.append('language', config.transcritorIdioma)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.openaiKey}` },
      body: form,
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      throw new Error(
        `OpenAI transcrição ${res.status}: ${(await res.text()).slice(0, 300)}`,
      )
    }
    const j = (await res.json()) as { text?: string }
    return (j.text ?? '').trim()
  },
}
