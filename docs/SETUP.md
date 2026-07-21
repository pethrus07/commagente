# zapagente — Ambiente de Desenvolvimento

Guia do zero ao rodando numa **máquina nova** (Windows). Seguindo isto, você levanta o projeto inteiro.

---

## 1. Pré-requisitos (o que instalar)

Abra o **PowerShell** e instale via `winget`:

```powershell
winget install -e --id Git.Git                # Git
winget install -e --id OpenJS.NodeJS.LTS       # Node.js LTS (>= 20) + npm
winget install -e --id Docker.DockerDesktop    # Docker Desktop
```

- Aceite o **UAC** em cada um.
- **Reinicie o Windows** depois do Docker (ele precisa do WSL2).
- Abra o **Docker Desktop** uma vez e espere o ícone 🐳 ficar **verde** ("Engine running").
- Feche e reabra o terminal pra os PATHs atualizarem.

**Recomendado no VSCode:** extensões *Prisma* e *Markdown Preview Mermaid Support* (pra ver os diagramas dos docs).

Confira as versões:
```powershell
git --version ; node -v ; npm -v ; docker --version
```

---

## 2. Clonar o projeto

```bash
git clone <URL_DO_REPO> zapagente
cd zapagente
```

---

## 3. Subir o banco (Docker)

```bash
docker compose -f infra/docker-compose.yml up -d db
```
Sobe um **PostgreSQL 16** persistente na porta `5432` (usuário/senha/banco = `zapagente`).

---

## 4. Instalar dependências e configurar env

```bash
cd apps/api
npm install
cp .env.example .env      # no PowerShell: Copy-Item .env.example .env
```
Os valores padrão do `.env` já batem com o `docker-compose.yml` — não precisa mexer pra rodar local. (Preencha `OPENAI_API_KEY` e as vars da Evolution quando chegar a hora.)

---

## 5. Criar as tabelas (migration)

```bash
npx prisma migrate dev
```
Aplica as migrations versionadas em `apps/api/prisma/migrations/` e gera o Prisma Client.

---

## 6. Rodar a API

```bash
npm run dev
```
- `http://localhost:3000/health` → `{"ok":true}` (API de pé)
- `http://localhost:3000/ready` → `{"ok":true,"db":"up"}` (banco respondendo)

Pra ver os dados de forma visual:
```bash
npx prisma studio        # abre em http://localhost:5555
```

---

## Portas e serviços

| Serviço | Porta | Onde |
|---|---|---|
| API (Fastify) | 3000 | `apps/api` (`npm run dev`) |
| PostgreSQL | 5432 | container `zapagente-db` |
| Prisma Studio | 5555 | `npx prisma studio` |
| Evolution API | 8080 | container `zapagente-evolution` (Fatia 2) |

## Variáveis de ambiente (`apps/api/.env`)

| Var | Pra quê |
|---|---|
| `DATABASE_URL` | conexão Postgres (Prisma) |
| `EVOLUTION_URL` / `EVOLUTION_API_KEY` | ponte WhatsApp (Fatia 2) |
| `OPENAI_API_KEY` | cérebro IA (provider-agnostic) |
| `PORT` | porta da API (padrão 3000) |
| `TZ` | `America/Sao_Paulo` |

## Comandos úteis

```bash
# banco
docker compose -f infra/docker-compose.yml up -d db     # sobe
docker compose -f infra/docker-compose.yml down         # derruba (mantém dados)
docker compose -f infra/docker-compose.yml logs -f db   # logs

# app (em apps/api)
npm run dev                 # API em watch
npm run build               # compila TS -> dist
npx prisma migrate dev      # nova migration + aplica
npx prisma studio           # UI do banco
npx prisma generate         # regenera o client
```

## Troubleshooting

- **Docker reclama de "virtualization":** habilite a virtualização na BIOS (Intel VT-x / AMD-V). No XPS costuma vir ligado.
- **`prisma generate` → `EPERM ... query_engine-windows.dll.node` (Windows):** algum processo node segura a DLL. Feche o `npm run dev`, rode `npx prisma generate` de novo. Se persistir: apague `apps/api/node_modules/.prisma` e regenere.
- **Porta 5432/3000 ocupada:** feche o serviço que está usando ou ajuste a porta no `.env` / `docker-compose.yml`.
- **Warning `package.json#prisma` deprecado:** conhecido (migrar pra `prisma.config.ts` antes do Prisma 7). Não bloqueia.

---

## Fatia 2 — Conexão (Evolution API)

Sobe a ponte de WhatsApp (Evolution + Postgres/Redis próprios dela):

```bash
docker compose -f infra/docker-compose.yml up -d evolution
```
- Evolution em `http://localhost:8080` (API key = `EVOLUTION_API_KEY` do `.env`, padrão `zapagente-dev-key`).
- A Evolution chama nosso webhook em `http://host.docker.internal:3000/webhook` (a API roda no host via `npm run dev`).

Conectar um número (⚠️ use um **chip dedicado/aquecido**, não o principal — risco de ban):
```bash
# 1) cadastra o número
curl -X POST localhost:3000/numeros -H "content-type: application/json" \
  -d '{"telefone":"5583999999999"}'
# 2) inicia a conexão → devolve o QR (base64); escaneie no WhatsApp do celular
curl -X POST localhost:3000/numeros/<ID>/conectar
# 3) confere o status (desconectado|conectando|conectado)
curl localhost:3000/numeros/<ID>/status
# 4) teste de envio (após conectado)
curl -X POST localhost:3000/envio -H "content-type: application/json" \
  -d '{"numeroId":"<ID>","telefone":"5583988888888","texto":"oi, teste"}'
```
Mensagens recebidas caem no `POST /webhook` → viram `Contato` + `Evento` (auditoria).

---

> Deploy de produção (VPS do parceiro) usa o mesmo Docker Compose, com Evolution + API + painel dockerizados — detalhado quando chegarmos lá.
