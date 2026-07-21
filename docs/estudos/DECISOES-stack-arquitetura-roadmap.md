# Destrincha — Roadmap, Stack & Arquitetura (decisões e dependências)

_Projeto: [[assistente-ia-whatsapp]] · Data: 2026-07-19 · Foco: decisões que **não dependem só do Pedro**._

**Legenda de dependência:**
🧑‍💼 = depende do **parceiro** (infra, orçamento, sociedade) · ⚖️ = **risco de plataforma** (Meta/WhatsApp) · 🛠️ = **técnica** (Pedro decide) · 💰 = **custo**

---

## PARTE A — STACK (decisão por decisão)

### S1. Camada de WhatsApp ⭐ (a decisão-mãe) — ⚖️🧑‍💼💰
Define risco de ban, custo e o que é permitido. Três caminhos:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **Não-oficial** (Evolution API + Baileys) | Sessão do WhatsApp Web logada num servidor | Grátis (só infra); permite iniciar conversa (prospecção); rápido | **Viola o ToS → risco de ban**; Meta muda protocolo e quebra até a comunidade corrigir |
| **API Oficial** (Cloud API Meta, via Evolution tb) | API empresarial da Meta | Sem ban; escala; entrega garantida | **€0,03–0,15 por conversa**; exige verificação de negócio; **proíbe cold outreach** (só opt-in + templates aprovados) |
| **Híbrido** | Não-oficial p/ missões ativas + Oficial p/ inbound opt-in | Melhor dos dois | Mais complexo (Fase 2+) |

- **Fato novo 2026 (⚖️, crítico):** o WhatsApp passou a rastrear **mensagens sem resposta em 48h**, de forma **cumulativa e válida pra qualquer API**. Passou do limite → restrições. Como prospecção fria vive de não-resposta, **isso é o maior risco do produto** e independe de nós.
- **Fato:** a Meta bane por **comportamento** (volume, spikes, taxa de bloqueio/denúncia, listas compradas), **não** por tipo de conexão.
- **Recomendação:** **Evolution API em modo não-oficial** no MVP (é o único que faz o caso de uso do parceiro), com **número dedicado + aquecimento + rate-limit** (ver Bloco S8/anti-bloqueio). Já deixar a porta aberta pro **híbrido** (Evolution também fala a API oficial) na Fase 2, pra inbound/opt-in.
- **Depende de:** ⚖️ tolerância a risco do parceiro (o chip **vai** poder cair) + decisão de negócio (prospecção fria vs base morna/opt-in).

### S2. Hospedagem — 🧑‍💼🛠️
- **Restrição técnica dura:** a camada WhatsApp precisa de **processo sempre ligado** (sessão logada, sockets). → **Serverless (Cloudflare Workers, que você domina) NÃO serve** pra isso.
- parceiro **já tem VPS + n8n na Hostinger**. → rodar **Evolution + backend + banco** na VPS via **Docker Compose**.
- **Recomendação:** VPS do parceiro (1 stack Docker). Seu Cloudflare pode servir só o painel estático, se quiser.
- **Depende de:** 🧑‍💼 **specs da VPS** (RAM/CPU/onde está) — **precisa levantar isso com ele** (Evolution + Postgres + Node pedem, na prática, ~2 vCPU / 4 GB pra folgar).

### S3. Backend — 🛠️
- **Node + Fastify + TypeScript** (Fastify > Express por performance e validação por schema). Você já domina Node.
- **Depende de:** só de você. Risco baixo.

### S4. Banco de dados — 🛠️🧑‍💼
- **Postgres** (relacional + JSON quando precisar) via Docker na VPS. SQLite só se quiser protótipo relâmpago.
- Hostinger costuma oferecer **MySQL** — dá também, mas Postgres ganha (JSON, `pgvector` p/ memória em grafo/embeddings na Fase 2).
- **Depende de:** 🛠️ + o que a VPS comporta (🧑‍💼).

### S5. IA (provider + modelo) — 💰🧑‍💼
- **Provider:** OpenAI (já conversado) — mas **arquitetar provider-agnostic** (trocar por Claude/aberto é 1 arquivo).
- **Modelo:** **mini/econômico** p/ 95% das conversas (ver estudo de memória); frontier só em missão que exija raciocínio pesado.
- **Depende de:** 💰 custo (já mostramos que é baixo) + preferência.

### S6. n8n: sim ou não — 🧑‍💼🛠️ (decisão conjunta)
- parceiro **tem e gosta** de n8n. Você prefere Node puro.
- **Trade-off:** n8n = visual e rápido de montar, mas vira **caixa-preta**, acopla e é difícil de versionar/testar. Node puro = controle total, testável, versionável.
- **Recomendação:** **Node puro no core** (motor de missão, rate-limit, memória — o que é crítico e sensível) e **n8n opcional na borda** (porta de integração: puxar lead de outro sistema, notificar). **Fora do caminho crítico.**
- **Depende de:** 🧑‍💼 é decisão dele também — vale explicar o porquê (o core precisa de controle fino de ritmo/estado que o n8n não dá bem).

### S7. Painel / Frontend — 🛠️
- **React + Vite** (você já usa no sinapse-app e no faro). MVP simples: cadastrar número, criar missão, lista de leads/status.
- **Depende de:** só de você.

### S8. Fila + Agendador (o motor anti-bloqueio) — 🛠️
- Precisa de **fila com atrasos** (rate-limit humano) + **cron** (rotinas Modo D).
- Opções: **fila no próprio Postgres + worker** (simples, MVP) → **BullMQ/Redis** (quando escalar).
- **Recomendação:** começar no Postgres; Redis só quando o volume pedir.
- **Depende de:** 🛠️ + infra (Redis na VPS na Fase 2).

---

## PARTE B — ARQUITETURA (como as peças se conectam)

```
[Painel React] ──HTTP──> [API Fastify]
                              │
        ┌─────────────────────┼──────────────────────────┐
        ▼                     ▼                          ▼
 [Máquina de estados]  [Montador de contexto]      [Fila + rate-limit]
   (missão: fila→        (memória: status+fatos       (atraso humano +
    conversa→concluída)   +resumo do banco)            cron de rotinas)
        │                     │                          │
        │                     ▼                          ▼
        │                [IA / OpenAI]              [Executor de envio]
        │             (resposta + status +               │
        │              categoria via structured output)  ▼
        │                                          [Evolution API] <──> WhatsApp
        └──────────────── tudo persiste em ──> [Postgres]
                                                    ▲
        WhatsApp ──webhook (msg recebida)──> [Ingestor] ──┘
```

**Fluxo de uma mensagem recebida:** Evolution manda webhook → Ingestor grava → Montador puxa a "ficha" do lead (memória) → IA responde e devolve `{resposta, novo_status, categoria}` (structured output) → resposta entra na **fila com atraso** (anti-bloqueio) → Executor envia via Evolution.

**Os 7 "caixas" do backend (destrinchar cada uma vira uma fatia/vertical-slice):**
1. **Ingestor de webhook** (recebe da Evolution)
2. **Montador de contexto/memória** (liga no estudo de memória)
3. **Cérebro IA** (chamada + structured output p/ status/categoria)
4. **Máquina de estados da missão**
5. **Fila + rate-limit + agendador** (anti-bloqueio + rotinas)
6. **Executor de envio**
7. **API do painel**

**Multi-tenancy (white-label) — decisão que casa com o negócio 🧑‍💼:**
- MVP = **single-tenant** (só Celiware). Mas **nascer com `tenant_id` em todas as tabelas** mesmo assim — custa quase nada agora e evita **reescrever tudo** quando o white-label chegar (Fase 3).

---

## PARTE C — ROADMAP (fases travadas por marco de negócio)

| Fase | Entrega | Destrava quando… | Depende de |
|---|---|---|---|
| **0 — MVP / Piloto** | Modo A (missão dirigida), 1 número **aquecido**, motor de missão + memória + anti-bloqueio + painel mínimo, single-tenant | rodar na empresa do parceiro e **provar que funciona sem tomar ban** | 🧑‍💼 VPS + número dedicado · ⚖️ aquecimento |
| **1 — Produto usável** | Templates de missão + **botões 1-clique (Modo C)** + escalada p/ humano + categorias + relatório | piloto validou; parceiro quer usar no dia a dia | 🛠️ |
| **2 — Escala de uso** | **Rotinas agendadas (Modo D)** + funil automático (Modo B) + multi-agente + **híbrido API oficial** p/ inbound opt-in | primeiro cliente pagante | ⚖️💰🧑‍💼 |
| **3 — Produto vendável** | **White-label / multi-tenant** + integração ecossistema (CRM, indicação) + memória em **grafo** | 2–3 clientes; hora de escalar a venda | 🧑‍💼 (sociedade) |

**Regra de ouro do roadmap:** cada fase só começa quando a anterior **provou valor** (piloto → 1 cliente → 3 clientes → white-label). Evita construir o SaaS inteiro antes de validar que o chip aguenta e o cliente paga.

---

## Decisões que precisam do parceiro/externo (levar pra conversa)
1. ⚖️ **Aceitar o risco de ban** (chip dedicado, pode cair) — ou pagar API oficial e abrir mão da prospecção fria.
2. 🧑‍💼 **Specs da VPS** dele (dá pra rodar Evolution + Postgres + Node?).
3. 🧑‍💼🛠️ **n8n no core, sim ou não** (recomendo não).
4. 🧑‍💼 **Quando o white-label entra** (muda a prioridade de multi-tenant).
5. ⚖️💰 **Prospecção fria vs base morna/opt-in** — a regra das 48h da Meta favorece começar com contatos mornos.

## Fontes
- Evolution API (repo/licença/recursos): https://github.com/evolution-foundation/evolution-api
- Oficial vs Evolution vs Baileys (custo/prática): https://blog.tipefy.com/api-oficial-do-whatsapp-vs-evolution-api-e-baileys-o-que-muda-na-pratica-para-sua-empresa
- Anti-ban 2026 (aquecimento, regra das 48h, comportamento): https://wasenderapi.com/blog/how-to-use-evolution-api-without-getting-banned-on-whatsapp-2026-guide · https://zaple.ai/blog/whatsapp-bulk-messages-avoid-ban/
