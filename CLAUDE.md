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
- **docs/pesquisa-mercado.html** — dossiê de mercado (abrir no navegador): ~50 concorrentes, quem faz "missões", features pra roubar, anti-ban, preços, posicionamento/fosso e o "tem que ter".

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

**Fatia 9 — Escalada pra humano: FEITA** (branch `main`, commit `aa76a29`):
- `Missao` ganhou **`iaPausada`** (humano no controle → a IA não responde) e **`motivoEscala`**.
- **Harness:** `precisa_humano` agora **pausa a IA** (`iaPausada=true`) e grava o motivo; no topo do `processarTurno` há guarda `if (iaPausada) return` (IA nunca responde pausada).
- **Ingestor:** só dispara `processarTurno` se `!iaPausada` (com humano no controle, a msg entra no histórico e o operador responde na mão).
- **Rotas:** `GET /escalados` (inbox), `POST /missoes/:id/assumir` (escalada→em_conversa, mantém IA pausada — humano dirige), `POST /missoes/:id/devolver-ia` (religa a IA no próximo inbound).
- **Painel:** página **Escalados** (inbox com motivo + última msg + "Assumir"), **badge** de contagem no menu, **banners** no detalhe (escalada→Assumir; pausada→Devolver pra IA).
- ✅ Validado ponta a ponta (harness real, lead de teste, sem envio): preço sem info → escala+pausa; assumir sai do inbox; devolver religa.

**Fatia 10 — Cap de conversas ativas + config anti-bloqueio: FEITA** (branch `main`, commit `6ca0f6a`):
- `NumeroWhatsapp` ganhou **`maxConversasAtivas`** (cap de conversas simultâneas conduzidas pela IA, default 20).
- **`iniciarMissao`** (Modo A) respeita o cap: conta ativas (`na_fila`+`em_conversa`) do número e retorna **409** ao atingir.
- **`PATCH /numeros/:id`** (`atualizarConfigNumero`) — edita janela (`HH:mm` validado), budget diário e cap.
- **Painel:** modal "anti-bloqueio" na página Números (janela/budget/cap) + cap visível no card.
- ✅ Validado: config inválida → 400; cap atingido → 409.
- ⚠️ Produção: o número de teste vivo (`5583900000001`) segue com janela dev `00:00–23:59` e budget 30 — **NÃO alterar durante o demo do parceiro**; ao deployar, ajustar via painel (ex.: `08:00–20:00`, budget conservador, cap baixo em chip novo).

**Fatia 11 — Disparo em lote: FEITA** (branch `main`, commit `b9dcd8f`):
- `criarMissaoEmLote`: **a mesma definição → N contatos**; cada contato vira uma missão própria (conversa/memória/estado independentes). `criarMissao` virou atalho (1 contato).
- **`POST /missoes/lote`** (valida número + lista de contatos).
- **Painel:** modal de criar aceita **lista de contatos** (um por linha: `telefone[, nome]`), com contagem ao vivo e botão dinâmico ("Criar N missões"). Ideal p/ disparar pra vários fornecedores/leads.

**Fatia 12 — Kanban-CRM: FEITA** (branch `main`, commit `96d9477`):
- **Missões vira board** por estado (colunas), com toggle **Board/Lista**. **Arrastar** um card muda o estado (validado pela máquina de estados; drop inválido é rejeitado e as colunas destino acendem). Board atualiza a cada 6s e marca "humano" quando `iaPausada`.
- **Página Contatos** (o "C" do CRM): tabela nome/telefone/origem/nº missões/criado + busca. **`GET /contatos`** (com contagem de missões).
- `lib/estados.ts` centraliza `TRANSICOES`/`COLUNAS`/`podeTransicionar` (removida a duplicata no MissaoDetalhe).

**Perguntas do Pedro (2026-07-22):** (a) **Áudio?** NÃO — o normalizador (`webhook.dominio.textoDaMensagem`) só lê texto + legendas; áudio/PTT cai em `ignorado`. Fatia futura: detectar `audioMessage` → baixar → transcrever (Whisper; local via faster-whisper OU API Whisper OpenAI ~US$0,006/min) → tratar como texto. (b) **Missão p/ vários contatos?** Resolvido na Fatia 11 (disparo em lote).

**Correções de robustez (2026-07-22):** `288cd3a` **reset diário do budget** (`enviadosHoje` zera na virada do dia via `enviadosData`; antes travava vitalício); `30ae2be` **turno resiliente** — lock por missão (2 mensagens seguidas do lead não geram resposta dupla) + **falha da IA visível** (erro vira evento `erro_ia`, escala pra humano e cai no inbox de Escalados).

**Revisão de arquitetura (2026-07-22, subagente):** camadas sólidas; achou P0s de segurança (sem auth, webhook aberto, `/envio` aberto) e anti-bloqueio (reset diário — corrigido; rajada em lote — pendente). Plano multi-tenant seguido abaixo.

**Multi-tenant + super-admin: FEITO** (MT-1..MT-4b):
- **MT-1** (`1039455`): `Usuario` + enum `Papel` (super_admin/admin_tenant/operador; tenantId nulo = super-admin); `@fastify/jwt` + `bcryptjs`; `POST /auth/login`, `GET /auth/eu`; hook `onRequest` exige token (exceto `/health` `/ready` `/auth/login` `/webhook`); seed de super-admin no boot; **login no painel** (token no localStorage, header Authorization, 401→login, logout).
- **MT-2** (`da6e01f`): contexto por requisição via **AsyncLocalStorage**; `tenantAtual()` no lugar de `garantirTenantPadrao()`. ⚠️ o `enterWith` NÃO propagava — **corrigido em `c76b59a`** usando `als.run(store, done)` no hook (callback-style). Sempre usar esse padrão.
- **MT-3** (`d3415c1`): isolamento — `conferirDono()` fecha IDOR nas operações por id (404 cross-tenant); create só no tenant do contexto. Worker/webhook seguem sem escopo (resolvem tenant por recurso).
- **MT-4a** (`c76b59a`): rotas `/admin` (super-admin) `GET/POST /admin/tenants`; super-admin opera como tenant via header **`x-tenant-id`** (impersonação); seed do **1º tenant "Cliente Demo"** (login `demo@zapagente.local` / `demo123`).
- **MT-4b** (`b0a810c`): painel de 2 níveis — seletor de tenant na sidebar + página **Tenants** (listar/criar) + nav por papel; api client envia `x-tenant-id`; trocar tenant remonta o conteúdo.
- **Logins semeados:** super-admin `admin@zapagente.local` / `zapagente123`; tenant demo `demo@zapagente.local` / `demo123`. Envs: `JWT_SECRET`, `SUPER_ADMIN_EMAIL/SENHA` (defaults de dev em `config.ts`; documentados no `.env.example`).
- ✅ Validado ponta a ponta (inclusive via proxy): sem token 401; papel errado em `/admin` 403; admin do demo vê 0 missões, super-admin impersonando Celiware vê 2 / Demo vê 0; IDOR cross-tenant → 404.

**Tema claro/escuro (polimento P-1, `91a4d25`):** tokens semânticos (`bg-surface`, `text-content`, `border-line`…) via CSS vars que trocam por `[data-theme]`; variante `dark:` ligada ao data-theme; toggle sol/lua na sidebar (`lib/tema.ts`). Esqueleto convertido (ui.tsx, App, Sidebar, Login, Dashboard, Conhecimento). ⚠️ **páginas antigas ainda dark-only** (board, detalhe, escalados, contatos, números, tenants) — visual foi **deprioritizado pelo Pedro** ("mexer bem depois"); dark é o padrão e está 100%.

**Memória — aprendizado de contexto (prioridade do Pedro): FEITO em 2 níveis.**
- **MEM-1 individual, por contato (`8cbd095`):** `Contato.memoria` (Json) acumula os `fatos_novos` de TODAS as missões daquele contato → persiste entre missões. O montador injeta `memoriaContato` no contexto; provedor OpenAI renderiza "memória deste contato (de conversas anteriores)". Painel: card "Memória do contato" no detalhe da missão.
- **MEM-2 coletiva, por tenant (`df66d8e`):** model **`Conhecimento`** (`sugerido`/`aprovado`/`rejeitado`, tenant-scoped). **Curada + IA sugere:** o harness CONSULTA os aprovados (injeta no contexto) e a IA PROPÕE aprendizados gerais (`aprendizado_sugerido` no schema de saída) gravados como `sugerido` p/ curadoria humana (dedupe por conteúdo). Painel: página **Conhecimento** (sugestões da IA + base ativa; aprovar/descartar/editar/remover). ✅ turno real: agente sugeriu "reforçar ROI em objeção de preço".
- **MEM-3 dashboards com histórico (`13fcd71`):** `GET /stats/historico?dias=N` — séries por dia (missões, mensagens, turnos, escaladas, concluídas) agregadas no fuso. Dashboard ganhou gráfico de atividade (14d) + totais do período.
- ⚠️ Memória hoje é **substituição/merge de chaves** (fatos key→value) — sem embeddings/recuperação semântica; conhecimento é injetado por "últimos N aprovados". Evolução futura: recuperação por relevância (embeddings) se a base crescer.

**Endurecimento anti-bloqueio + segurança: FEITO (HARD-1..3).**
- **HARD-1 anti-rajada (`69abb0e`):** `NumeroWhatsapp.proximoEnvioEm` — o worker só envia se `agora >= proximoEnvioEm` e agenda o próximo após enviar (`intervaloEnvioMs`: opener 45–90s, resposta 12–30s). Mata rajada de lote/reabertura de janela. Harness detecta opener (sem saída prévia) → `tipo: 'novo'` no payload + jitter certo.
- **HARD-2 fila resiliente (`de6634d`):** falha de envio → retry com backoff (30s→10min, 5 tentativas) e só então dead-letter (`erro`). `fila.repo.reagendar`.
- **HARD-3 segurança (`2b8180e`):** idempotência — `@@unique([tenantId, providerMsgId])` em `mensagens`; ingestor ignora reentrega da Evolution (sem turno duplo). `/envio` valida dono (`enviarTextoManual`+`conferirDono`; worker usa `enviarTexto` direto).
- ⚠️ **Migration com risco de constraint** (idempotência): `migrate dev` é interativo e trava no ambiente headless → criei a migration à mão + `prisma migrate deploy` (checar duplicatas antes). Usar esse fluxo p/ constraints daqui pra frente.

**Falta p/ deploy na VPS (P0 restantes):** **segredo no webhook** (token na URL + reconfigurar a Evolution — natural no deploy; hoje a API só é acessível localmente, então ainda não explorável) + **helmet/rate-limit/CORS explícito** + segredos de produção fortes (`JWT_SECRET`, Postgres, Evolution key) + ajustar janela/budget/cap dos números via painel.

**LEVANTAMENTO DE MERCADO (2026-07-22):** dossiê visual publicado (Artifact) — 6 frentes, ~50 players. Achado central: **ninguém combina os 5 atributos das "missões"** (proativo + missão variável por conversa + multi-conversa + escala humana + WhatsApp-BR/PME); "missão" é marca livre (setor usa Procedure/Topic/Goal); memória coletiva é gap do mercado (nosso fosso); anti-ban é sobrevivência (perfil = 15–30% ban/ano). Decisão do Pedro: **fazer TODOS os tiers do "tem que ter"**, começando pelo Tier 0.

**Tier 0 — anti-ban (sobrevivência): FEITO (AB-1..4), tudo do levantamento.**
- **AB-1 saúde do número + throttle (`02435be`):** `numeros.dominio.classificarSaude` (reply-rate 30d de missões iniciadas há +48h; status saudável/atenção/**risco**<15%). `iniciarMissao` **pausa novas iniciações (409)** quando em risco — ataca o gatilho 2026 de mensagens não-respondidas. Selo de saúde no painel Números. Opener agora termina com pergunta pra gerar resposta.
- **AB-2 cap por contato (`70b6d3f`):** máx. 2 iniciações/contato/semana (409).
- **AB-3 opt-out/opt-in (`68da75b`):** `Contato.optOut/optInEm`; ingestor detecta "PARAR" (sinais fortes) → bloqueia + não aciona IA; worker cancela envio a opted-out; `iniciarMissao` bloqueia; opt-in registrado (inbound/manual/lote) — LGPD.
- **AB-4 teto por estágio (`70b6d3f`):** `tetoDiarioPorEstagio` (20/50/120/250/400); worker usa `min(budgetDiario, tetoEstágio)`.
- ⚠️ Ainda no radar do Tier 0 (não feito): cap **horário** hard (<30/h — hoje mitigado pelo espaçamento serial), **progressão automática** de estágio, pool de chips rotativos, proxy residencial por chip.

**Tier 1 — identidade "agente com missão": FEITO.**
- **T1-1 tipo + anatomia (`3cd9213`):** `Missao.tipo` (vender/qualificar/orcar/**cobrar**/suporte/outro) + `criterioConclusao`. O montador aplica comportamento por tipo (o "objetivo variável" que ninguém no mercado faz) + o critério entra na persona. Seletor de tipo + campo critério no criar/editar; selo de tipo no board e detalhe.
- **T1-2 fechar o loop + placar (`84f6622`):** `Missao.resultado`; a IA registra o desfecho ao concluir (`SaidaIA.resultado`); stats ganha `missoesPorTipo` + `placar` (cumpridas/perdidas/ativas + taxa de conclusão); Dashboard mostra o placar; detalhe mostra card de Resultado. ✅ validado ao vivo: cobrança com critério cumprido → `concluida` + resultado "pagamento confirmado".
- **T1-3 resumo no handoff (`84f6622`):** ao escalar, atualiza o resumo (handoff fresco pro humano).

**Tier 2 — memória/aprendizado: FEITO.** MEM-1 (individual) + MEM-2 (coletiva) + **auto vs co-pilot (`704a9ab`)**: `Missao.modo` (auto|copilot) + `Missao.rascunho` + `Campanha.modo`. Em co-pilot a IA **rascunha** (não envia); painel mostra card do rascunho (editar/aprovar/descartar); `POST /missoes/:id/rascunho/aprovar|descartar`. Modo escolhível no criar/editar missão e criar campanha.

**Contatos-CRM + Campanhas (pedido do Pedro, 2026-07-22): FEITO.**
- **CRM-1 (`eb6a920`):** contatos viram base acionável — `POST /contatos` (novo), `/contatos/importar` (CSV parseado no painel), `/contatos/importar-whatsapp` (puxa a agenda via `evolutionClient.buscarContatos` → `/chat/findContacts`), `GET /contatos/exportar` (CSV). Painel: botões Novo/CSV/WhatsApp/Exportar + selo opt-out. Opt-in registrado na criação/import.
- **CRM-2 (`dbc609c`):** picker de contatos da base ao criar missão (busca + checkbox, combina com "colar novos", exclui opt-out).
- **CAMP-1 (`44c6c33`):** model **`Campanha`** (definição da missão) + `Missao.campanhaId`. Criar campanha dispara pra N contatos (reusa `criarMissaoEmLote` com `campanhaId`); **adicionar contatos a uma campanha em andamento** cria novas missões com a mesma definição. Rotas `/campanhas` (GET/POST, GET/:id, POST/:id/contatos). Painel: página **Campanhas** (lista + placar) + Nova campanha + Adicionar contatos; componente **`SeletorContatos`** reutilizável; `parseContatos` em `lib/contatos.ts`.

**Sistema roda LOCAL (2026-07-22):** Docker Desktop + `docker compose -f infra/docker-compose.yml up -d` (4 containers: `zapagente-db`, `zapagente-evolution` :8080, evolution-db, evolution-redis) → `cd apps/api && npm run dev` (:3000) → `cd apps/painel && npm run dev` (:5173). Logins: super-admin `admin@zapagente.local`/`zapagente123`, tenant demo `demo@zapagente.local`/`demo123`.

**Próximo:** **Tier 3** (áudio/Whisper · builder visual de missões · escada p/ API oficial). Depois: **deploy VPS** (P0: segredo webhook + helmet/rate-limit + segredos de produção) e **polimento visual** (páginas restantes p/ tema claro). **`git push`**: origin/main sincronizado até o dossiê; **CRM-1/2 + CAMP-1 + Tier 2 ainda locais** (aguarda OK do Pedro). Tiers 0, 1 e 2 do "tem que ter" = COMPLETOS.
