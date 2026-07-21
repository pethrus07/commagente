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
Fase **F0 (MVP)**. **Fatia 1 — Fundação: FEITA**.

**Fatia 2 — Conexão: FEITA e TESTADA AO VIVO** (merge no `main`). Conectar número (QR), ingestor (webhook), executor (envio + digitação simulada), status de entrega — validado ponta a ponta com chip real (evoapicloud/evolution-api v2.3.1).

**Fatia 3 — Missão + Máquina de Estados: FEITA** (branch `feat/fatia3-missoes`):
- Migration: `mensagens.missao_id` agora é **opcional** (mensagem pode existir sem missão).
- `features/missoes/` — máquina de estados (domínio puro, transição inválida → 409), CRUD de missão, transição de estado.
- **Ingestor** liga a mensagem recebida à **missão ativa** do contato+número → grava em `mensagens` (direção in) e destrava `na_fila → em_conversa`.
- **Executor** grava a saída em `mensagens` (direção out, status `enviando → ok` via webhook).
- Rotas novas: `POST /missoes`, `GET /missoes`, `GET /missoes/:id` (com histórico), `POST /missoes/:id/estado`.

**Próximo → Fatia 4 (Cérebro IA):** chamada provider-agnostic + structured output (`resposta, novo_estado, categoria, fatos_novos, precisa_humano`) — a IA passa a conduzir a conversa. Depois: Fatia 5 (memória/ficha) e Fatia 6 (fila anti-bloqueio).
