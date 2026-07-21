# zapagente — contexto do projeto

Assistente autônomo de IA no **WhatsApp** que opera várias conversas em paralelo, cada uma com uma **"missão"** (vender, qualificar, orçar, cobrar, suporte…). Parceria **Pedro (Pethrus) × parceiro (Celiware)**. Single-tenant hoje, `tenant_id`-ready para white-label.

## Como rodar
Máquina nova → siga **[docs/SETUP.md](docs/SETUP.md)** (winget: Git + Node LTS + Docker Desktop → `docker compose -f infra/docker-compose.yml up -d db` → `cd apps/api && npm install` → `cp .env.example .env` → `npx prisma migrate dev` → `npm run dev`). Checar: `/health` e `/ready`.

## Stack
Node + **Fastify** + TS · **PostgreSQL** (via **Prisma**) · fila no Postgres + worker · **Evolution API** (WhatsApp, não-oficial) · IA **provider-agnostic** (OpenAI mini) · painel **React + Vite** · Docker Compose. Monólito modular; arquitetura em camadas (Apresentação → Aplicação → Domínio ← Infra) com Regra de Dependência.

## Documentação (ler antes de mexer)
- **docs/SETUP.md** — ambiente do zero.
- **docs/ROADMAP.md** — divisão de funcionalidades (8 grupos) + matriz por fase F0–F3.
- **docs/ARQUITETURA.md** — decisões + alternativas; §1.1 camadas; §1.2 o harness do agente.
- **docs/MODELO-DADOS.md** — ERD + as 8 tabelas (schema em `apps/api/prisma/schema.prisma`).
- **docs/estudos/** — pesquisa que fundamenta tudo (não versionar dados reais/LGPD).

## Convenções
- **Idioma:** PT-BR (código, docs, commits).
- **Commits:** mensagem curta em PT-BR, tipo convencional (`feat:`, `docs:`, `chore:`), **sem trailer de co-autoria**.
- **Ritmo:** construir **parte a parte, um commit por etapa**. Docs visuais com **mermaid**.
- **Segredos:** nunca versionar `.env` (só `.env.example`); nada de dados reais/CPF no git.

## Estado atual (jul/2026)
Fase **F0 (MVP)**. **Fatia 1 — Fundação: FEITA** (scaffold Fastify/TS, docker-compose do Postgres, schema Prisma, 1ª migration → 8 tabelas, `/ready` OK).

**Fatia 2 — Conexão: CÓDIGO FEITO** (branch `feat/fatia2-conexao`; falta só o teste ao vivo = escanear o QR com um chip dedicado):
- Evolution API + Redis no `docker-compose` (Postgres/Redis próprios da Evolution).
- `core/evolution/` — porta WhatsApp (interface) + cliente Evolution (adapter HTTP).
- `features/numeros/` — cadastrar número, conectar (devolve QR), status.
- `features/webhook/` — ingestor: recebe evento, captura contato, audita em `eventos`.
- `features/envio/` — executor: digitação simulada + envio + status.
- Rotas: `POST /numeros`, `POST /numeros/:id/conectar`, `GET /numeros/:id/status`, `POST /webhook`, `POST /envio`.

⚠️ **Decisão pendente:** `mensagens.missaoId` é obrigatório → na Fatia 2 inbound/outbound são auditados em `eventos`. Ao entrar a **Fatia 3 (Missões)** eles passam a gravar em `mensagens` (ou torna-se `missaoId` opcional — decidir).

**Próximo → teste ao vivo da Fatia 2** (conectar número real + E2E), depois **Fatia 3 (Missão + estados)**.
