# Commagente

> **Commagente** (comunicação + agente; lê como "com a gente") — nome do produto decidido em **2026-07-28** (antes *zapagente*). Identificadores internos (repo, DB, containers, logins) seguem `zapagente` por ora.

Assistente autônomo de IA que opera **várias conversas de WhatsApp em paralelo, cada uma com uma "missão"** (vender, qualificar, pedir orçamento, cobrar, dar suporte…), conduzindo cada conversa ao longo do dia como uma secretária humana — no ritmo humano, para não tomar bloqueio.

> Parceria **Pedro (Pethrus) × parceiro (Celiware)**. Plataforma **multi-tenant** (super-admin + tenants, white-label). Painel React + API Fastify; memória (individual + coletiva), anti-bloqueio, transcrição de áudio, campanhas e suporte reativo já construídos.

> **Para entender o código sozinho, comece por [docs/ARQUITETURA.md](docs/ARQUITETURA.md).**

## Stack

| Camada | Escolha |
|---|---|
| WhatsApp | Evolution API (Baileys / não-oficial) |
| Backend | Node + Fastify + TypeScript |
| Banco | PostgreSQL (Docker) |
| IA | OpenAI (modelo mini), camada provider-agnostic |
| Fila/agenda | Fila no Postgres + worker |
| Painel | React + Vite |
| Deploy | Docker Compose na VPS |

## Documentação

- **[docs/SETUP.md](docs/SETUP.md)** — ambiente de desenvolvimento do zero (o que instalar + rodar). **Máquina nova começa aqui.**
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — divisão de funcionalidades e ordem de construção (comece por aqui).
- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)** — **o manual**: como o sistema funciona hoje, do mapa do repositório ao caminho de uma mensagem ponta a ponta, o motor anti-bloqueio, as receitas, o status medido no código e as armadilhas. As decisões de stack e as alternativas descartadas estão na §16.
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — subir e manter a VPS (always-on, backup, segredos, HTTPS).
- **[docs/MODELO-DADOS.md](docs/MODELO-DADOS.md)** — ERD visual das **16 tabelas** e as convenções do schema Prisma (fonte da verdade em `apps/api/prisma/schema.prisma`).
- **[docs/estudos/](docs/estudos/)** — pesquisa e decisões que fundamentam o projeto (arquitetura, memória/custo, anti-bloqueio, proposta).

## Rodar em desenvolvimento

```bash
# 1. subir o Postgres (precisa de Docker)
docker compose -f infra/docker-compose.yml up -d db

# 2. dependências + cliente Prisma
cd apps/api
npm install

# 3. aplicar as migrations (42 hoje) num banco vazio ou já existente
npx prisma migrate deploy

# 4. subir a API (+ os 3 workers: fila, agendador, reconciliador)
npm run dev        # http://localhost:3000/health  e  /ready

# 5. subir o painel (noutro terminal)
cd ../painel && npm install && npm run dev   # http://localhost:5173
```

- `GET /health` — a API está de pé (não depende do banco).
- `GET /ready` — confirma que o Postgres responde.
- `npx prisma studio` — inspeciona os dados no navegador.

> Sem Docker? A migration precisa de um Postgres acessível — use o Docker Desktop **ou** um Postgres gerenciado (ex.: Neon/Supabase) e aponte o `DATABASE_URL` do `apps/api/.env` pra ele.

## Status

**Em produção** desde 25/07/2026 (VPS com Docker Compose + pm2 + Caddy), com clientes reais.
Construídos e no ar: conversa com IA (harness com contrato validado e guardrail anti-invenção),
motor anti-bloqueio, memória individual e coletiva com RAG, CRM, campanhas, missões programadas,
tags, DNA hierárquico, biblioteca de mídia, modo Roteiro, transcrição de áudio, suporte reativo e
o painel multi-tenant. Testes de unidade do domínio: **61/61 passando**.

Não existe ainda a **camada comercial** (planos, quotas por tenant, billing, teto de custo por
tenant, hard-delete LGPD). O estado completo, medido no código, está em
[docs/ARQUITETURA.md §14](docs/ARQUITETURA.md); o que vem a seguir, em
[docs/ROADMAP.md](docs/ROADMAP.md).
