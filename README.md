[Português](README.pt-BR.md)

# Commagente

An AI assistant that runs many WhatsApp conversations at the same time. Each conversation has a "mission" (sell, qualify, ask for a quote, collect a payment, give support). The AI talks at a human pace so the number does not get blocked, and hands the conversation to a person when it should.

## Status

In production since July 2026, multi-tenant, with real customers. The production server has been offline since 2026-10-22; the project is in low-maintenance mode. Built with a partner company from the industrial automation sector.

## The problem

Small businesses lose leads because nobody answers WhatsApp in time, and follow-ups depend on someone remembering. Generic chatbots answer menus; they do not pursue a goal. Commagente gives each conversation a goal, keeps memory of the contact, and stops itself when it would have to invent a price or a promise.

## What it does

- Conversation driven by AI with a validated output contract and a rule against inventing facts (price, deadline, promise). Outside the authorized information it asks or escalates.
- Anti-blocking engine: send window, daily budget by number stage, spacing between messages, opt-out ("PARAR"), cap per contact.
- Memory per contact and shared knowledge per tenant, with retrieval by relevance (embeddings).
- CRM, campaigns, scheduled missions, tags, media library, voice note transcription, reactive support.
- Multi-tenant panel: a super-admin manages tenants and can act as any tenant; each tenant only sees its own data.

## Stack

| Layer | Choice |
|---|---|
| WhatsApp | Evolution API (Baileys, unofficial), running in the project's own Docker Compose |
| Backend | Node, Fastify, TypeScript |
| Database | PostgreSQL through Prisma (16 models, 42 migrations) |
| Queue and scheduler | Queue in Postgres plus in-process workers |
| AI | OpenAI (mini model) behind a provider-agnostic port; an offline stub provider for development |
| Panel | React, Vite, Tailwind |
| Deploy | Docker Compose, pm2 and Caddy on a VPS |

## Run locally

Requirements: Node 20 or newer, Docker. The full guide for a new machine is in [docs/SETUP.md](docs/SETUP.md).

```bash
# 1. database (copy infra/.env.example to infra/.env to change passwords)
docker compose -f infra/docker-compose.yml up -d db

# 2. API
cd apps/api
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev            # http://localhost:3000/health and /ready

# 3. panel (another terminal, from the repo root)
cd apps/painel && npm install && npm run dev   # http://localhost:5173
```

To connect a real WhatsApp number, bring up the whole compose (`docker compose -f infra/docker-compose.yml up -d`), which adds the Evolution API with its own Postgres and Redis.

## Tests

```bash
cd apps/api && npm test        # domain unit tests (node:test via tsx), 61 cases
cd e2e && npm test             # Playwright end to end; needs API and panel running
```

## Folders

```
apps/api       API (Fastify) and workers: src/core (infra, ports) and src/features (one folder per domain)
apps/painel    React panel
e2e            Playwright suite
infra          Docker Compose (full and slim for small VPS), Caddyfile, DB init
docs           architecture, data model, deploy, roadmap, studies, history
```

## Architecture

Start with [docs/ARQUITETURA.md](docs/ARQUITETURA.md) (Portuguese): repository map, the path of a message end to end, the anti-blocking engine and known pitfalls. Diagrams (UML, BPMN, C4) are in [docs/arquitetura/](docs/arquitetura/). Data model in [docs/MODELO-DADOS.md](docs/MODELO-DADOS.md). Deploy in [docs/DEPLOY.md](docs/DEPLOY.md).

## Decisions and known limits

- Unofficial WhatsApp (Baileys) means some incoming messages can stay as "waiting for this message" and never reach the API. The plan to move to the official Cloud API is in [docs/escada-api-oficial.md](docs/escada-api-oficial.md).
- Production still starts the API with `tsx src/server.ts`. The branch `revisao-2026-11` fixes the ESM imports so `npm run build` and `node dist/server.js` work; it is not deployed yet.
- There is no commercial layer yet (plans, quotas per tenant, billing, cost ceiling per tenant, hard delete for LGPD).
- Embedding similarity runs in memory (no pgvector); fine for the current knowledge size.
- Code, docs and commits are in Portuguese.

## Roadmap

[docs/ROADMAP.md](docs/ROADMAP.md). The construction diary is in [docs/HISTORICO.md](docs/HISTORICO.md).

## License

All rights reserved.
