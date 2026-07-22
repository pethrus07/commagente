// 💛/🔌 A PORTA da camada de transcrição de áudio (provider-agnostic).
// O domínio/aplicação falam só com esta porta; trocar OpenAI/Whisper↔local↔dublê = trocar o adapter.

export interface AudioEntrada {
  /** áudio bruto em base64 (ex.: nota de voz opus/ogg do WhatsApp) */
  base64: string
  /** mimetype se conhecido (ajuda o provedor a detectar o formato) */
  mimetype?: string
}

export interface TranscritorAudio {
  readonly nome: string
  /** transcreve o áudio em texto. Retorna '' quando não há fala reconhecível. */
  transcrever(audio: AudioEntrada): Promise<string>
}
