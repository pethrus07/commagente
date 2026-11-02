# Commagente — contexto do projeto

> **Nome do produto (decidido 2026-07-28): `Commagente`** (antes *zapagente*). Junta *comunicação + agente* e lê como "com a gente" (o "M" dobrado evita a leitura "coma gente"). Domínios `commagente.com.br`/`.com` livres. **Exibição/painel/docs usam Commagente.** **Já renomeados (2026-07-28):** repo **`pethrus07/commagente`**, pm2 **`commagente-api`**, pacote **`@commagente/api`**. **Ainda `zapagente` (infra viva — rename à parte, com janela):** DB/containers `zapagente-*`, logins `*@zapagente.local`, pasta `~/zapagente` (local e VPS), instância Evolution `zap-<tel>`. ⚠️ **Build:** imports relativos SEMPRE com `.js` (o `tsconfig` em `NodeNext` recusa sem extensão). Produção: `npm run build` + `pm2 start dist/server.js --name commagente-api` (até o deploy deste branch, a VPS ainda roda `npx tsx src/server.ts`).

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

## Armadilhas vivas (resumo; detalhes em docs/HISTORICO.md)
- **Contexto por requisição:** use `als.run(store, done)` no hook (o `enterWith` não propaga).
- **Migration com constraint:** `migrate dev` trava sem terminal; escreva a migration à mão e rode `prisma migrate deploy` (confira duplicatas antes).
- **Produção:** com ufw default-deny, libere `172.16.0.0/12 → :3000` para o webhook da Evolution chegar (ver docs/DEPLOY.md).
- **"Aguardando esta mensagem"** é limite do Baileys (não-oficial), não bug nosso; a cura é a Cloud API oficial (docs/escada-api-oficial.md).
- **Budget anti-bloqueio** vale só para `tipo==='novo'` (outreach); resposta a cliente sempre flui.
- **`NODE_ENV=production`** recusa segredo default/fraco no boot (`config.ts`).

## Histórico
O diário de construção (fatias 1 a 12, tiers, auditorias, bugs ao vivo) está em **[docs/HISTORICO.md](docs/HISTORICO.md)**.
