// 🔐 Hash de senha (bcryptjs — JS puro, sem build nativo).
import bcrypt from 'bcryptjs'

export const senha = {
  hash: (texto: string) => bcrypt.hash(texto, 10),
  conferir: (texto: string, hash: string) => bcrypt.compare(texto, hash),
}
