# Deploy — Hetzner (produção, always-on)

Guia enxuto pra subir o zapagente num VPS **Hetzner CX33** (4 vCPU / 8 GB) com **Ubuntu 24.04**.
Complementa o [SETUP.md](SETUP.md) (que é o ambiente de desenvolvimento). ~30–40 min.

**Pré-requisito:** um domínio (ex.: `painel.seudominio.com`) com **registro A** apontando pro IP do server (é o que dá HTTPS no painel).

---

## 1. Criar o server
No [console.hetzner.com](https://console.hetzner.com/): **New Server → Ubuntu 24.04 → aba Shared vCPU → CX33 →** adicione sua chave SSH → Create. Anote o IP.

## 2. Acesso + firewall (só 22/80/443)
```bash
ssh root@SEU_IP
apt update && apt -y upgrade
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 3. Docker + Node + Caddy
```bash
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt -y install nodejs
apt -y install caddy
npm i -g pm2
```

## 4. Código + segredos
```bash
git clone https://SEU_TOKEN@github.com/pethrus07/zapagente.git
cd zapagente/apps/api && cp .env.example .env && nano .env
```
No `.env` de produção troque **todos** os segredos:
- `DATABASE_URL` — senha forte (a mesma do `infra/docker-compose.yml`).
- `JWT_SECRET` — aleatório longo (`openssl rand -hex 32`).
- `EVOLUTION_API_KEY` — forte (a mesma do compose).
- `OPENAI_API_KEY` — a chave do parceiro. `IA_PROVIDER=openai` e `EMBEDDINGS_PROVIDER=openai`.
- `WEBHOOK_SECRET` — `openssl rand -hex 16`.
- `WEBHOOK_URL="http://host.docker.internal:3000/webhook/<WEBHOOK_SECRET>"` (o mesmo segredo).
- `CORS_ORIGIN="https://painel.seudominio.com"`.

Ajuste as senhas do Postgres/Evolution no `infra/docker-compose.yml` pra baterem com o `.env`.

## 5. Infra + banco + RAG
```bash
cd ~/zapagente && docker compose -f infra/docker-compose.yml up -d
cd apps/api && npm ci
npx prisma migrate deploy && npx prisma generate
npx tsx scripts/backfill-rag.mts   # indexa o conhecimento p/ o RAG
npm run build
```

## 6. Subir a API (reinicia sozinha, sobe no boot)
```bash
pm2 start npm --name zapagente-api -- start
pm2 startup && pm2 save
```
A API já inicia o **worker anti-bloqueio** + o **agendador** de missões programadas.

## 7. Painel + HTTPS (Caddy)
```bash
cd ~/zapagente/apps/painel && npm ci && npm run build
cp ~/zapagente/infra/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile   # troque painel.seudominio.com
systemctl reload caddy      # HTTPS sai sozinho (Let's Encrypt)
```

## 8. Conectar o WhatsApp
Abra `https://painel.seudominio.com` → login super-admin → **troque a senha** → **Números** → cadastre o chip → **QR** → escaneie. Mande uma mensagem de teste e veja a IA responder.

---

## P0 de segurança / operação (não pular)
- **Evolution não exposta:** o `infra/docker-compose.yml` já binda Postgres e Evolution em `127.0.0.1` (não vão pra internet). Confirme com `ss -tlnp | grep -E '8080|5432'` (deve mostrar `127.0.0.1`).
- **Webhook com segredo:** confira que `WEBHOOK_URL` tem o `/<WEBHOOK_SECRET>` no fim (senão a Evolution não entrega e o endpoint fica fechado).
- **Backup do Postgres:** ligue *snapshot* no Hetzner **e/ou** um `pg_dump` em cron:
  ```bash
  (crontab -l 2>/dev/null; echo "0 3 * * * docker exec zapagente-db pg_dump -U zapagente zapagente | gzip > /root/backup-\$(date +\%F).sql.gz") | crontab -
  ```
- **Teto de gasto na OpenAI:** defina um limite hard + alerta na conta do parceiro (a key é única e compartilhada).
- **Segredos:** nenhum valor default (JWT / Postgres / Evolution / webhook).

## Atualizar o sistema depois
```bash
cd ~/zapagente && git pull
cd apps/api && npm ci && npx prisma migrate deploy && npm run build && pm2 restart zapagente-api
cd ../painel && npm ci && npm run build   # Caddy já serve o dist novo
```
