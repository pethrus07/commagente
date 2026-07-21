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

  // Ponte WhatsApp (Fatia 2 — Conexão)
  evolution: {
    url: process.env.EVOLUTION_URL ?? 'http://localhost:8080',
    apiKey: obrigatorio('EVOLUTION_API_KEY'),
  },

  // URL que a Evolution (no Docker) usa pra chamar nosso webhook.
  // Em dev a API roda no host → host.docker.internal alcança a :3000.
  webhookUrl:
    process.env.WEBHOOK_URL ?? 'http://host.docker.internal:3000/webhook',
}
