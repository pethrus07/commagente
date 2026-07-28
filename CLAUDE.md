# Commagente — contexto do projeto

> **Nome do produto (decidido 2026-07-28): `Commagente`** (antes *zapagente*). Junta *comunicação + agente* e lê como "com a gente" (o "M" dobrado evita a leitura "coma gente"). Domínios `commagente.com.br`/`.com` livres. **Exibição/painel/docs usam Commagente.** **Já renomeados (2026-07-28):** repo **`pethrus07/commagente`**, pm2 **`commagente-api`**, pacote **`@commagente/api`**. **Ainda `zapagente` (infra viva — rename à parte, com janela):** DB/containers `zapagente-*`, logins `*@zapagente.local`, pasta `~/zapagente` (local e VPS), instância Evolution `zap-<tel>`. ⚠️ **A API de prod roda via `npx tsx src/server.ts` (NÃO `node dist` — imports ESM sem `.js` quebram); `pm2 restart commagente-api` reusa esse comando.**

Assistente autônomo de IA no **WhatsApp** que opera várias conversas em paralelo, cada uma com uma **"missão"** (vender, qualificar, orçar, cobrar, suporte…). Parceria **Pedro (Pethrus) × parceiro (Celiware)**. **Multi-tenant** (super-admin + tenants, isolamento por `tenant_id` + impersonação via `x-tenant-id`) — plataforma white-label.

## Como rodar
Máquina nova → siga **[docs/SETUP.md](docs/SETUP.md)** (winget: Git + Node LTS + Docker Desktop → `docker compose -f infra/docker-compose.yml up -d db` → `cd apps/api && npm install` → `cp .env.example .env` → `npx prisma migrate dev` → `npm run dev`). Checar: `/health` e `/ready`.

## Stack
Node + **Fastify** + TS · **PostgreSQL** (via **Prisma**) · fila no Postgres + worker · **Evolution API** (WhatsApp, não-oficial) · IA **provider-agnostic** (OpenAI mini) · painel **React + Vite** · Docker Compose. Monólito modular; arquitetura em camadas (Apresentação → Aplicação → Domínio ← Infra) com Regra de Dependência.

## Documentação (ler antes de mexer)
- **docs/SETUP.md** — ambiente do zero.
- **docs/ROADMAP.md** — divisão de funcionalidades (8 grupos) + matriz por fase F0–F3.
- **docs/ARQUITETURA.md** — decisões + alternativas; §1.1 camadas; §1.2 o harness do agente.
- **docs/MODELO-DADOS.md** — ERD + tabelas (11 models: +Usuario, Conhecimento, Campanha além das 8 originais; schema em `apps/api/prisma/schema.prisma` é a fonte da verdade).
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

**Tier 3 — áudio (transcrição de notas de voz): FEITO (T3-A).** Camada `core/transcricao/` provider-agnostic (espelha `core/ia`): porta `TranscritorAudio` + adapter **OpenAI Whisper** (`/v1/audio/transcriptions`, modelo `whisper-1`, idioma `pt` — configuráveis por env `TRANSCRITOR_MODELO`/`TRANSCRITOR_IDIOMA`/`TRANSCRITOR_PROVIDER`; segue `IA_PROVIDER` por padrão) + **dublê** offline. `PortaWhatsApp.baixarMidiaBase64` (Evolution `POST /chat/getBase64FromMediaMessage`). O webhook detecta `audioMessage` (`webhook.dominio` → `EventoWa.audio`), pega o base64 (embutido se `webhookBase64=true`, senão baixa) e **transcreve → segue o fluxo de texto normal** (grava inbound + dispara o turno). Se falhar, grava "🎤 (áudio recebido — não foi possível transcrever)" e não aciona a IA; evento `audio_transcrito` registra `ok`/`chars`. **Testado ao vivo (round-trip TTS→Whisper + webhook simulado com base64 embutido):** áudio→texto exato→inbound→turno (escalou no preço por guardrail; enfileirou numa saudação respondível). ⚠️ Único leg não testado ao vivo: o download `baixarMidiaBase64` (precisa de nota de voz real no chip conectado).

**Tier 3 — builder visual de missões: FEITO (T3-B).** Assistente em 3 passos (`apps/painel/src/components/AssistenteMissao.tsx`) substitui o formulário cru de Nova missão: **(1) Modelo** — grade de modelos prontos (`lib/modelos-missao.ts`: prospecção, follow-up, qualificação, orçamento, cobrança, suporte, reativação, do-zero) que pré-preenchem objetivo/tom/critério/modo; **(2) Ajustar** — campos em linguagem simples com dicas (guardrail de informações autorizadas explicado); **(3) Contatos + revisão** — reusa `SeletorContatos` + card "resumo da missão". Cria via `criarLote` (1 conversa por contato). Antigo `NovaMissaoModal`/`parseContatos` locais removidos de `Missoes.tsx`.

**Tier 3 — escada p/ API oficial: FEITO (T3-C, planejamento + seam).** Doc **[docs/escada-api-oficial.md](docs/escada-api-oficial.md)**: estratégia em 4 degraus (0 Evolution → 1 adapter Cloud API opcional → 2 híbrido "esquenta no não-oficial, escala no oficial" → 3 enterprise), o dilema não-oficial×oficial (frio livre vs. janela 24h/templates/opt-in/custo), o que muda no domínio e o caminho no código. **Seam de código:** `core/evolution/index.ts` seleciona o provider por `WHATSAPP_PROVIDER` (espelha `IA_PROVIDER`/`TRANSCRITOR_PROVIDER`); as features agora importam `{ whatsapp }` (não mais `evolutionClient` direto). Plugar o adapter oficial vira mudança de 1 arquivo + normalizador de webhook. **Tier 3 COMPLETO** (áudio + builder + escada). Validado: typecheck 0, API /ready + /numeros (usa o port) OK.

**Sistema roda LOCAL (2026-07-22):** Docker Desktop + `docker compose -f infra/docker-compose.yml up -d` (4 containers: `zapagente-db`, `zapagente-evolution` :8080, evolution-db, evolution-redis) → `cd apps/api && npm run dev` (:3000) → `cd apps/painel && npm run dev` (:5173). Logins: super-admin `admin@zapagente.local`/`zapagente123`, tenant demo `demo@zapagente.local`/`demo123`.

**Melhorias de contatos/suporte (pedido do Pedro, 2026-07-22):**
- **IMP-1 (`5cc8261`):** botão **"selecionar todos"** no `SeletorContatos` (respeita a busca) — vale no assistente de missão e em campanhas.
- **IMP-2 (`8069f81`): suporte reativo por número.** `NumeroWhatsapp.suporteReativo` + persona (`suporte*`). Um **inbound sem missão ativa** num número reativo **abre uma conversa de suporte na hora** (`em_conversa`, evento `suporte_reativo`) e aciona a IA — cobre "todos + quem entrar em contato". Liga-se no **assistente** (tipo Suporte, toggle "atende 24/7", contatos viram opcionais) e gerencia-se na **página de Números** (toggle + selo). Testado ON/OFF.

**Revisão + QA pré-demo (2026-07-22):** revisão 360° (3 agentes) + suite **Playwright** em `e2e/` (login, navegação sem erros de runtime, assistente de missão, contatos+campanha, suporte reativo). Corrigidos: worker sem `.catch` (BLOCKER), duplo `iniciar` (409), `ia.resumir` best-effort, timeouts OpenAI, **tema forçado dark** (toggle removido), **busca de contatos** (`includes('')` casava todos). **Tenants renomeados:** `PEDRO` (chip conectado) e `Celiware` (p/ conectar o nº do parceiro); tenant padrão = PEDRO.

**Missões Programadas (`ab91cff` backend + `26d7ea3` painel):** modelo **`Agendamento`** (por contato) — dispara sozinho na data. `recorrencia` (uma_vez|mensal) · `diaDoMes`|`dataUnica` · `entrega` (`ia` conduz | `fixa` texto) · `pularCicloRef` ("pago/pular este mês") · idempotência por ciclo (`ultimoCicloRef`). **Agendador** (`agendamentos.worker`, 5min + boot) dispara quem "vence hoje" (fuso BR; dia 31→último dia; opt-out não dispara; uma_vez desativa). `ia`→missão na_fila+opener; `fixa`→missão IA-pausada+texto na fila (tudo pela fila/anti-ban). Painel: aba **Programadas** (tabela + Novo agendamento com single/CSV + pausar/pular/editar/remover). Rotas `/agendamentos` (+lote/pular/disparar). Testado: unit (clamp/idempotência/uma_vez/pular/opt-out) + smoke HTTP + E2E de navegação.

**Correções pós-teste Costa Doce (2026-07-23):** **CORR-1** guardrail estrito + escala não-silenciosa (manda a msg-ponte antes de pausar) + rastreio de campos; **robustez** doc-send + timeout Evolution + watchdog worker; **tema claro** completo + toggle restaurado; **DOC-1** ingestão de documento (PDF/DOCX/TXT → Conhecimento, aba Conhecimento → "Importar documento"); **CORR-2** presença best-effort + teto efetivo no painel (`tetoEfetivo`); **CORR-3 debounce anti-duplo-texto** — o webhook agenda o turno (janela 7s), rajada de mensagens do lead vira UM turno (`agendarTurno`).

**Custo & escala (2026-07-23):**
- **COST-1 — instrumentação de custo:** `Missao.tokensEntrada/tokensSaida` acumulam o `usage` de cada chamada OpenAI (via `ContextoIA.coletarUso`, callback opcional que só o provedor real preenche). Painel: card **"Custo de IA"** no detalhe da missão (tokens + estimativa US$/R$), **visível SOMENTE para super-admin**.
- **COST-2 — throttle do resumo:** `resumir` roda a cada 3 turnos (ou ao concluir), não todo turno — corta ~1/3 das chamadas (as últimas 8 msgs cruas cobrem a recência).
- **RAG-1 — recuperação por relevância:** `core/embeddings/` provider-agnostic (text-embedding-3-small, cosseno em memória, sem pgvector; segue `IA_PROVIDER`) + model **`ConhecimentoChunk`**. Cada Conhecimento aprovado é fatiado (`dividirEmChunks`) e vetorizado; (re)indexa em criar/importar/editar/aprovar, limpa em rejeitar/remover (cascade). O harness injeta **só os trechos relevantes** (últimas msgs do lead como consulta) — **degrada p/ "todo o conhecimento aprovado"** quando embeddings off (dublê) ou base sem chunks. Ingestão de doc subiu p/ 60k chars. `scripts/backfill-rag.mts` indexa o existente (rodar 1x no deploy). ✅ Testado: relevância, turno completo usa o fato certo, cascade, backfill.

**Revisão 360° (2026-07-23, 2 subagentes + visual ao vivo):** arquitetura + roadmap + visual. Achados de código CORRIGIDOS (commit REV-1): **B1** RAG podia descartar o turno em silêncio se a API de embeddings falhasse (rodava fora do try) → `conhecimentoRelevante` nunca lança + fallback; **A1** item aprovado sem chunk some da IA → entra inteiro; **A2** guarda de dimensão + backfill dim-aware; **A3** `chunksDoTenant` por `status='aprovado'` (rejeitado nunca servido); **A4** debounce re-agenda na contenção do lock; **M1 (segurança)** tokens escondidos no servidor p/ não-super; **M2** uso no retorno da porta (não callback). Dívida conhecida aceita: M3 cosseno em memória (pgvector é o plano quando a base crescer), M4 incremento best-effort. Visual: card de custo + tema claro/escuro consistentes nas telas novas (nit menor: moeda usa ponto decimal, tokens usam separador pt-BR).

**Próximo:** **deploy VPS** — mas o escopo certo é "**always-on desassistido**", não só "subir o código". P0 confirmados: segredo no webhook + helmet/rate-limit/CORS + segredos de produção fortes + **rodar `backfill-rag.mts`** 1×. P0 que a revisão de roadmap adicionou (bloqueadores de produção, não pós-deploy): **alerta de chip caído/saúde=risco + heartbeat do worker**, **backup do Postgres** (pg_dump em cron — hoje ZERO backup), **teto de gasto na conta OpenAI** (key única do parceiro, sem freio), **proteger a Evolution API** (:8080 só interna). **Camada comercial (pré-revenda) — NÃO existe e não estava no roadmap:** `Tenant.ativo`/plano + billing, **quotas por tenant** (nº de números/missões/features), **custo + teto por tenant** (COST-1 é por-missão), gestão de usuários por tenant + reset de senha, branding white-label real, hard-delete LGPD. Backlog menor: UI de biblioteca por pastas + OCR (§8.1); dashboard de custo agregado (§8.3); degrau 1 da escada oficial. **Tiers 0–3 = COMPLETOS** + CRM, Campanhas, Suporte reativo, Programadas, RAG, instrumentação de custo.

**Estilo / perfil de conversa — o "parecer humano" (2026-07-27 noite, deployado):** controles estruturados de COMO ESCREVER injetados no prompt com **alta saliência** (`features/tenant/tenant.estilo.ts` → `regrasDeEstilo`): formalidade (informal/equilibrado/formal) · **emoji sim/não** · abreviações · **proibir travessão `—`** (a maior marca de robô) · **bolhas** (quebra a resposta em 2-3 msgs curtas). O executor (`enviarTexto`) divide a resposta em bolhas por `\n` (cada uma vira mensagem separada, com "digitando…" entre elas; budget anti-ban conta cada bolha) — continua **UM item de fila** (anti-rajada preservado). **Perfil por MISSÃO:** `Missao.estilo` (+ `Campanha.estilo`) JSON; **perfis por papel** (Vendedor/Suporte/Cobrança…) embutidos nos **modelos de missão** (`painel/lib/estilos-conversa.ts` PERFIS + `modelos-missao.ts`), vêm ao escolher o modelo, editáveis → "Personalizado", **salvos na missão**; `montarFicha`/harness usam `missao.estilo ?? tenant.estilo`. **`Tenant.estilo` = "padrão da casa" (fallback).** UI: `components/EstiloControles.tsx` (compartilhado, com preview vivo) no passo "Ajustar" do `AssistenteMissao` + na tela Conhecimento. Migrations `20260728130000_tenant_estilo` + `20260728140000_missao_campanha_estilo`. ✅ **Provado ao vivo (self-send):** opener + resposta em 3 bolhas cada, informal, sem travessão. ⚠️ pro `gpt-4o-mini` obedecer as bolhas foi preciso exemplo explícito de `\n` no prompt + neutralizar o "1-3 frases"/"PRIMEIRA mensagem" do provedor. e2e `novidades.spec` cobre o padrão do tenant.

**Produção — recebimento de inbound: 2 gotchas conhecidos (2026-07-28, no onboarding do Desbravando):**
- **(1) ufw bloqueia o webhook de entrada.** O Evolution (container) entrega o inbound na API do host via `host.docker.internal:3000`; com **ufw default-deny** (só 22/80/443) esse tráfego container→host:3000 é **DROPADO sem erro visível** → mensagens recebidas **não aparecem no painel**. Raiz: `host.docker.internal` resolve p/ `172.17.0.1` mas o container roda na rede `infra_default` (gw `172.18.0.1`); de todo jeito o ufw barrava a 3000. **Fix permanente (aplicado na VPS):** `ufw allow from 172.16.0.0/12 to any port 3000 proto tcp` (só bridges internas do Docker, nada público; persiste em reboot). Diagnóstico: `docker exec zapagente-evolution node -e "fetch('http://host.docker.internal:3000/health')..."` (o container NÃO tem curl). Documentado no `docs/DEPLOY.md`.
- **(2) "aguardando esta mensagem" (Baileys/não-oficial) — segue valendo.** Quando a sessão Baileys não DECIFRA a mensagem recebida (E2E/Signal), o WhatsApp mostra "aguardando esta mensagem" e o Evolution **não emite o `messages.upsert`** → o inbound **nunca chega na API**. NÃO é bug nosso; agrava com sessão nova/reconexão. **Fix definitivo = WhatsApp Cloud API oficial (degrau 1 da escada, `docs/escada-api-oficial.md`).** Foi o sintoma no teste do Desbravando (28/07): número conectado, webhook OK, ufw liberado — e mesmo assim o inbound não gravava, com "aguardando mensagem" no aparelho.
