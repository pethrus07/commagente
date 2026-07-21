# zapagente

Assistente autônomo de IA que opera **várias conversas de WhatsApp em paralelo, cada uma com uma "missão"** (vender, qualificar, pedir orçamento, cobrar, dar suporte…), conduzindo cada conversa ao longo do dia como uma secretária humana — no ritmo humano, para não tomar bloqueio.

> Parceria **Pedro (Pethrus) × parceiro (Celiware)**. Single-tenant no início, `tenant_id`-ready para white-label depois.

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

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — divisão de funcionalidades e ordem de construção (comece por aqui).
- **[docs/estudos/](docs/estudos/)** — pesquisa e decisões que fundamentam o projeto (arquitetura, memória/custo, anti-bloqueio, proposta).

## Status

Em estruturação (jul/2026). Construção parte a parte, mirando o MVP (Fase 0).
