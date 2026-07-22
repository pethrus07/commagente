// "5583999998888, Fulano" (um por linha; vírgula/; separa nome) → contatos válidos
export function parseContatos(txt: string): { telefone: string; nome?: string }[] {
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [tel, ...resto] = l.split(/[,;\t]/)
      return { telefone: (tel ?? '').replace(/\D/g, ''), nome: resto.join(' ').trim() || undefined }
    })
    .filter((c) => c.telefone.length >= 8)
}
