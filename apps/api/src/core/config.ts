/**
 * 🔌 Configuração — o ÚNICO lugar que lê `process.env`. Toda feature importa `config`, nunca
 * a variável crua: assim o nome de cada segredo aparece num arquivo só, os defaults de dev
 * ficam visíveis e ninguém precisa caçar env espalhada pelo código.
 * No fim do arquivo mora a TRAVA DE PRODUÇÃO (fail-fast) — ver comentário lá embaixo.
 */
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

  // WhatsApp Cloud API oficial (Meta) — degrau 1 da escada (docs/escada-api-oficial.md).
  // Só usado quando WHATSAPP_PROVIDER=cloud. Credenciais vêm da conta Meta Business
  // (App > WhatsApp): token permanente + phone_number_id; verifyToken é o segredo do webhook.
  cloud: {
    token: process.env.CLOUD_API_TOKEN ?? '',
    phoneNumberId: process.env.CLOUD_API_PHONE_ID ?? '',
    verifyToken: process.env.CLOUD_API_VERIFY_TOKEN ?? '',
    graphVersion: process.env.CLOUD_API_GRAPH_VERSION ?? 'v20.0',
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
  // Em PRODUÇÃO, inclua o segredo no caminho: .../webhook/<WEBHOOK_SECRET>
  webhookUrl:
    process.env.WEBHOOK_URL ?? 'http://host.docker.internal:3000/webhook',
  // Segredo do webhook: se definido, só aceita POST /webhook/<segredo> (fecha o webhook aberto).
  // Vazio em dev = sem checagem (a API só é acessível localmente).
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  // CORS: origem(ns) do painel permitidas em produção (separadas por vírgula).
  // Vazio = libera geral (dev usa proxy do Vite, mesma origem → não precisa).
  corsOrigin: process.env.CORS_ORIGIN ?? '',

  // Autenticação (JWT). Em produção defina JWT_SECRET forte no .env.
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-zapagente-troque-em-producao',

  // Super-admin semeado no boot (login inicial do painel).
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@zapagente.local',
    senha: process.env.SUPER_ADMIN_SENHA ?? 'zapagente123',
  },
}

// 🔒 Trava de produção (fail-fast): em NODE_ENV=production, RECUSA subir com segredo
// ausente/fraco/default. Dev e local seguem com os defaults de conveniência (guard dormente).
// Fecha a classe "inseguro por default" (JWT/super-admin/webhook/evolution/CORS).
const DEFAULTS_INSEGUROS = new Set([
  'dev-secret-zapagente-troque-em-producao',
  'troque-por-um-segredo-forte-em-producao',
  'zapagente123',
  'demo123',
  'zapagente-dev-key',
])
if (process.env.NODE_ENV === 'production') {
  const fraco = (v: string | undefined, min: number) => !v || v.length < min || DEFAULTS_INSEGUROS.has(v)
  const problemas: string[] = []
  if (fraco(process.env.JWT_SECRET, 32)) problemas.push('JWT_SECRET ausente/fraco/default (>=32 chars)')
  if (fraco(process.env.SUPER_ADMIN_SENHA, 10)) problemas.push('SUPER_ADMIN_SENHA ausente/fraca/default (>=10 chars)')
  if (fraco(process.env.WEBHOOK_SECRET, 16)) problemas.push('WEBHOOK_SECRET ausente/fraco (>=16 chars)')
  if (fraco(process.env.EVOLUTION_API_KEY, 16)) problemas.push('EVOLUTION_API_KEY ausente/fraca/default (>=16 chars)')
  if (!process.env.CORS_ORIGIN) problemas.push('CORS_ORIGIN ausente (não deixe liberado geral em produção)')
  if (problemas.length > 0) {
    throw new Error(
      'CONFIG DE PRODUÇÃO INSEGURA — ajuste o .env antes de subir:\n  - ' + problemas.join('\n  - '),
    )
  }
}
