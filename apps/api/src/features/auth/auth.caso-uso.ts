// ⚙️ Aplicação — login (verifica credenciais).
import { db } from '../../core/db.js'
import { ErroHttp } from '../../core/erros.js'
import { senha } from '../../core/senha.js'

export async function autenticarUsuario(email: string, senhaTexto: string) {
  const usuario = await db.usuario.findUnique({ where: { email: email.toLowerCase() } })
  // mensagem genérica (não revela se o e-mail existe)
  if (!usuario) throw new ErroHttp(401, 'E-mail ou senha inválidos')
  const ok = await senha.conferir(senhaTexto, usuario.senhaHash)
  if (!ok) throw new ErroHttp(401, 'E-mail ou senha inválidos')
  return usuario
}
