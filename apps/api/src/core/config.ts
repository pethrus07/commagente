import 'dotenv/config'

function obrigatorio(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return v
}

export const config = {
  databaseUrl: obrigatorio('DATABASE_URL'),
  porta: Number(process.env.PORT ?? 3000),
  tz: process.env.TZ ?? 'America/Sao_Paulo',
}
