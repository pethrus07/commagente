// 📞 Normaliza um telefone brasileiro pro formato que o WhatsApp/Evolution aceita: com o DDI 55.
// SEM o 55, o JID (ex.: 11900000002@s.whatsapp.net) é inválido e o Evolution devolve
// `exists:false` (o número "não existe") — foi o que quebrava o aviso de escalonamento quando o
// número do chip estava salvo sem o código do país. Self-send funciona normalmente com o 55.
export function telefoneBR(bruto: string): string {
  const d = (bruto ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d // já tem DDI
  if (d.length === 10 || d.length === 11) return '55' + d // DDD + número → adiciona o DDI
  return d // formato inesperado: devolve como está (não força um palpite errado)
}
