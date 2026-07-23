// 🔌 Infraestrutura — extrai texto de um documento (PDF, DOCX ou TXT) a partir de base64.
// Import dinâmico das libs pesadas (só carrega quando alguém sobe um doc).

export async function extrairTexto(
  base64: string,
  mimetype: string,
  nomeArquivo: string,
): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')
  const nome = (nomeArquivo || '').toLowerCase()
  const m = (mimetype || '').toLowerCase()

  if (m.includes('pdf') || nome.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const r = await parser.getText()
      return (r.text || '').trim()
    } finally {
      await parser.destroy()
    }
  }

  if (
    m.includes('officedocument.wordprocessing') ||
    m.includes('msword') ||
    nome.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth')
    const r = await mammoth.extractRawText({ buffer })
    return (r.value || '').trim()
  }

  // txt / markdown / fallback: trata como texto puro
  return buffer.toString('utf8').trim()
}
