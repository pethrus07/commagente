// 🔌 Transcrição DUBLÊ — offline, sem chamar nenhuma API (dev sem key).
// Não transcreve de verdade; devolve um marcador pro fluxo não travar.
import type { TranscritorAudio } from './porta-transcricao.js'

export const transcritorDuble: TranscritorAudio = {
  nome: 'duble',
  async transcrever(): Promise<string> {
    return '[áudio recebido — transcrição indisponível no modo dublê]'
  },
}
