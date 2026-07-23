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

  // IA (Fatia 4b) — provider-agnostic; só necessária se IA_PROVIDER=openai
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModelo: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',

  // Transcrição de áudio (Tier 3) — provider-agnostic (TRANSCRITOR_PROVIDER).
  // openai usa a mesma OPENAI_API_KEY; modelo/idioma configuráveis.
  transcritorModelo: process.env.TRANSCRITOR_MODELO ?? 'whisper-1',
  transcritorIdioma: process.env.TRANSCRITOR_IDIOMA ?? 'pt',

  // Embeddings (RAG do conhecimento) — provider-agnostic (EMBEDDINGS_PROVIDER).
  // text-embedding-3-small: 1536 dims, ~US$0,02/1M tokens (barato).
  embeddingsModelo: process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small',

  // URL que a Evolution (no Docker) usa pra chamar nosso webhook.
  // Em dev a API roda no host → host.docker.internal alcança a :3000.
  webhookUrl:
    process.env.WEBHOOK_URL ?? 'http://host.docker.internal:3000/webhook',

  // Autenticação (JWT). Em produção defina JWT_SECRET forte no .env.
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-zapagente-troque-em-producao',

  // Super-admin semeado no boot (login inicial do painel).
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@zapagente.local',
    senha: process.env.SUPER_ADMIN_SENHA ?? 'zapagente123',
  },
}
