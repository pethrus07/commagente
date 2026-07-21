// Erro de domínio/aplicação com status HTTP — o handler do Fastify lê o statusCode.
export class ErroHttp extends Error {
  statusCode: number
  constructor(statusCode: number, mensagem: string) {
    super(mensagem)
    this.statusCode = statusCode
    this.name = 'ErroHttp'
  }
}
