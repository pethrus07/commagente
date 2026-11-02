[English](README.md)

# Commagente

Assistente de IA que conduz várias conversas de WhatsApp ao mesmo tempo. Cada conversa tem uma "missão" (vender, qualificar, pedir orçamento, cobrar, dar suporte). A IA escreve no ritmo de uma pessoa para o número não ser bloqueado e passa a conversa para um humano quando deve.

## Status

Em produção desde julho de 2026, multi-tenant, com clientes reais. O servidor de produção está fora do ar desde 22/10/2026; o projeto está em baixo toque. Feito em parceria com uma empresa do setor de automação industrial.

## O problema

Pequenas empresas perdem contatos porque ninguém responde o WhatsApp a tempo, e o acompanhamento depende de alguém lembrar. Chatbot comum responde menu; não persegue um objetivo. O Commagente dá um objetivo a cada conversa, guarda memória do contato e para sozinho quando teria que inventar um preço ou uma promessa.

## O que faz

- Conversa conduzida por IA com contrato de saída validado e regra contra inventar fato (preço, prazo, promessa). Fora das informações autorizadas, ela pergunta ou escala.
- Motor anti-bloqueio: janela de envio, budget diário por estágio do número, espaçamento entre mensagens, opt-out ("PARAR"), limite por contato.
- Memória por contato e conhecimento coletivo por tenant, com recuperação por relevância (embeddings).
- CRM, campanhas, missões programadas, tags, biblioteca de mídia, transcrição de áudio, suporte reativo.
- Painel multi-tenant: o super-admin gerencia os tenants e pode operar como qualquer um; cada tenant só vê os próprios dados.

## Stack

| Camada | Escolha |
|---|---|
| WhatsApp | Evolution API (Baileys, não-oficial), rodando no próprio Docker Compose do projeto |
| Backend | Node, Fastify, TypeScript |
| Banco | PostgreSQL via Prisma (16 models, 42 migrations) |
| Fila e agenda | Fila no Postgres e workers no mesmo processo |
| IA | OpenAI (modelo mini) atrás de uma porta independente de provedor; provedor dublê offline para desenvolvimento |
| Painel | React, Vite, Tailwind |
| Deploy | Docker Compose, pm2 e Caddy numa VPS |

## Rodar localmente

Precisa de Node 20 ou mais novo e Docker. O guia completo para máquina nova está em [docs/SETUP.md](docs/SETUP.md).

```bash
# 1. banco (copie infra/.env.example para infra/.env para trocar as senhas)
docker compose -f infra/docker-compose.yml up -d db

# 2. API
cd apps/api
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev            # http://localhost:3000/health e /ready

# 3. painel (outro terminal, a partir da raiz do repo)
cd apps/painel && npm install && npm run dev   # http://localhost:5173
```

Para conectar um número real de WhatsApp, suba o compose inteiro (`docker compose -f infra/docker-compose.yml up -d`), que acrescenta a Evolution API com Postgres e Redis próprios.

## Testes

```bash
cd apps/api && npm test        # testes de unidade do domínio (node:test via tsx), 61 casos
cd e2e && npm test             # Playwright ponta a ponta; precisa da API e do painel rodando
```

## Pastas

```
apps/api       API (Fastify) e workers: src/core (infra, portas) e src/features (uma pasta por domínio)
apps/painel    painel React
e2e            suíte Playwright
infra          Docker Compose (completo e enxuto para VPS pequena), Caddyfile, init do banco
docs           arquitetura, modelo de dados, deploy, roadmap, estudos, histórico
```

## Arquitetura

Comece por [docs/ARQUITETURA.md](docs/ARQUITETURA.md): mapa do repositório, o caminho de uma mensagem de ponta a ponta, o motor anti-bloqueio e as armadilhas. Os diagramas (UML, BPMN, C4) estão em [docs/arquitetura/](docs/arquitetura/). Modelo de dados em [docs/MODELO-DADOS.md](docs/MODELO-DADOS.md). Deploy em [docs/DEPLOY.md](docs/DEPLOY.md).

## Decisões e limites conhecidos

- WhatsApp não-oficial (Baileys): algumas mensagens recebidas ficam em "aguardando esta mensagem" e nunca chegam na API. O plano para a Cloud API oficial está em [docs/escada-api-oficial.md](docs/escada-api-oficial.md).
- A produção ainda sobe a API com `tsx src/server.ts`. O branch `revisao-2026-11` corrige os imports ESM para `npm run build` e `node dist/server.js` funcionarem; ainda não foi para produção.
- Ainda não existe camada comercial (planos, cota por tenant, cobrança, teto de custo por tenant, exclusão definitiva para a LGPD).
- A similaridade dos embeddings roda em memória (sem pgvector); serve para o tamanho atual da base.
- Código, docs e commits em português.

## Roadmap

[docs/ROADMAP.md](docs/ROADMAP.md). O diário de construção está em [docs/HISTORICO.md](docs/HISTORICO.md).

## Licença

Todos os direitos reservados.
