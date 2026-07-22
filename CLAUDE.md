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

**Fatia 4 — Cérebro IA: FEITA** (branch `feat/fatia4-cerebro`) — validada AO VIVO com auto-resposta:
- `core/ia/` — porta `ProvedorIA` (provider-agnostic) + contrato `SaidaIASchema` (structured output) + **provedor DUBLÊ** (offline, determinístico). Seleção por `IA_PROVIDER` (default `duble`).
- `features/conversa/` — o **harness** `processarTurno`: monta contexto (ficha mínima) → IA → **valida o contrato (zod)** → mescla fatos → guardrail `precisa_humano` (escala) → aplica `novo_estado` (se transição válida) → responde pelo executor.
- **Ingestor aciona o cérebro**: inbound em missão ativa dispara `processarTurno` (fire-and-forget — não segura o 200 do webhook; a fila/worker da Fatia 6 formaliza).

⚠️ **Fatia 4b (pendente):** adapter **OpenAI real** em `core/ia/` (precisa `OPENAI_API_KEY`) — hoje roda no dublê.

**Fatia 5 — Memória: FEITA** (branch `feat/fatia5-memoria`) — validada com dublê:
- `features/memoria/montador` — monta a **ficha** rica: persona (papel+objetivo+contexto) + resumo rolante + fatos + últimas N (8) mensagens. O harness usa `montarFicha`.
- **Resumo rolante:** `ProvedorIA.resumir` (+ dublê) → o harness atualiza `missao.resumo` a cada turno (memória de longo prazo; com IA real dá pra throttlar por N turnos).

**Fatia 6 — Fila anti-bloqueio: FEITA** (branch `feat/fatia6-fila`) — validada com dublê:
- `features/fila/` — domínio (janela de horário, budget diário, jitter), repo (`fila_envio` + contador `enviados_hoje`) e **worker** (loop 3s, sem sobreposição).
- O **harness enfileira** a resposta (com jitter) em vez de enviar direto; o **worker** consome respeitando janela+budget e envia pelo executor no ritmo humano (validado: inbound→reply ~21s depois). Worker inicia no boot do server.
- ⚠️ Dev: a janela do número de teste foi ampliada p/ `00:00–23:59` (o padrão de números novos é `08:00–20:00`). "Cap de conversas ativas" fica pro fluxo de iniciar missão (Modo A) — ainda não wired.

**Fatia 7 — Painel React: FEITA** (branch `feat/fatia7-painel`) — `apps/painel` (Vite+React+TS+Tailwind v4):
- Dashboard (KPIs + pipeline), Números (cadastrar + conectar via QR c/ poll), Missões (lista filtrável + criar), Detalhe (conversa em bolhas + ações de estado + resumo/fatos). Proxy `/api`→:3000 (sem CORS).
- API ganhou `GET /numeros` e `GET /stats` (leitura p/ o painel).
- Rodar: `cd apps/painel && npm install && npm run dev` → http://localhost:5173.

**Fatia 4b — OpenAI real: FEITA** (`core/ia/provedor-openai.ts`, chat completions + JSON mode; `IA_PROVIDER=openai`, `OPENAI_MODEL=gpt-4o-mini`). **Modo A — FEITO** (`POST /missoes/:id/iniciar` → IA abre a conversa). **DEMO AO VIVO PRO PARCEIRO: sucesso** (a IA conduziu a venda sozinha).

**Fatia 8 — Config de missão + guardrail anti-alucinação: FEITA** (branch `main`, commit `c3ca5d1`):
- `Missao` ganhou **`tom`** (humor/estilo) e **`informacoes`** (base de fatos AUTORIZADOS: preço/prazo/condições que a IA pode afirmar).
- **Guardrail** na `montarPersona`: regra inviolável — a IA **nunca inventa** preço/número/prazo/promessa; fora das informações autorizadas ela **confirma ou escala** (`precisa_humano`). O provedor OpenAI renderiza o bloco de informações com alta saliência (e avisa explicitamente quando não há nenhuma).
- **`PATCH /missoes/:id`** (`editarMissao`) — editar objetivo/contexto/tom/informações/nome; reflete no próximo turno.
- **Painel:** campos de tom/informações no criar + **card de Configuração** e **modal de edição** no detalhe.
- ✅ Validado com **OpenAI real** (sem WhatsApp): sem info → não inventa preço e escala; com preço autorizado → usa o valor real.

**Próximo (F1+ antes do deploy):** (2) **escalada pra humano no painel** (fila/inbox de escalados + destravar `escalada→em_conversa`); (3) **cap de conversas ativas** + janela/budget de produção; (4) **`git push`**. Depois: throttle do resumo (−custo), custo real no painel, **deploy na VPS**. Melhoria pedida pelo Pedro: painel virar um **mini kanban-CRM** (missões/números/contatos organizados) — manter em mente ao evoluir o painel.
