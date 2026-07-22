# zapagente

Assistente autônomo de IA que opera **várias conversas de WhatsApp em paralelo, cada uma com uma "missão"** (vender, qualificar, pedir orçamento, cobrar, dar suporte…), conduzindo cada conversa ao longo do dia como uma secretária humana — no ritmo humano, para não tomar bloqueio.

> Parceria **Pedro (Pethrus) × parceiro (Celiware)**. Plataforma **multi-tenant** (super-admin + tenants, white-label). Painel React + API Fastify; memória (individual + coletiva), anti-bloqueio, transcrição de áudio, campanhas e suporte reativo já construídos.

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
- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)** — o que usamos, por quê e as alternativas descartadas (decisões) + modelo em camadas + o harness do agente.
- **[docs/MODELO-DADOS.md](docs/MODELO-DADOS.md)** — tabelas (11 models no schema atual), ERD visual e o schema Prisma (fonte da verdade).
- **[docs/estudos/](docs/estudos/)** — pesquisa e decisões que fundamentam o projeto (arquitetura, memória/custo, anti-bloqueio, proposta).

## Rodar em desenvolvimento

```bash
# 1. subir o Postgres (precisa de Docker)
docker compose -f infra/docker-compose.yml up -d db

# 2. dependências + cliente Prisma
cd apps/api
npm install

# 3. criar as tabelas (1ª migration)
npx prisma migrate dev --name init

# 4. subir a API
npm run dev        # http://localhost:3000/health  e  /ready
```

- `GET /health` — a API está de pé (não depende do banco).
- `GET /ready` — confirma que o Postgres responde.
- `npx prisma studio` — inspeciona os dados no navegador.

> Sem Docker? A migration precisa de um Postgres acessível — use o Docker Desktop **ou** um Postgres gerenciado (ex.: Neon/Supabase) e aponte o `DATABASE_URL` do `apps/api/.env` pra ele.

## Status

Em estruturação (jul/2026). Construção parte a parte, mirando o MVP (Fase 0).
