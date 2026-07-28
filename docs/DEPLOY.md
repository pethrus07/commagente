# Deploy — produção (always-on)

Guia pra subir o Commagente num VPS **Ubuntu 22.04/24.04 LTS**. Serve pra qualquer provedor
(Hostinger, Hetzner, Contabo…). Complementa o [SETUP.md](SETUP.md) (ambiente de dev).

> **Escolha do servidor (2026-07):** parceiro optou pela **Hostinger** (data center **São Paulo**),
> plano **4 GB (KVM1)** ciente de que é apertado. Por isso este guia tem um **caminho enxuto**
> (1 Postgres) e um passo **obrigatório de swap**. Em plano maior (≥ 8 GB) o caminho é o mesmo,
> só que dá pra usar o compose cheio (`infra/docker-compose.yml`).

**Pré-requisito:** um domínio (ou subdomínio) apontando pro IP do server (registro **A**) —
é o que dá HTTPS no painel. Na Hostinger dá pra usar o hostname temporário `srvXXXX.hstgr.cloud`.

---

## 0. Criar o server
- **Hostinger** → VPS → **Ubuntu 24.04 (64-bit), SEM painel** (nada de CyberPanel/cPanel/Plesk); localização **São Paulo**. (Se houver template "Ubuntu 24.04 + Docker", pode usar.)
- **Hetzner:** [console.hetzner.com](https://console.hetzner.com/) → New Server → Ubuntu 24.04 → CX33.
- Adicione sua **chave SSH** (ou defina a senha de root).

## 1. Acesso + SWAP (crítico no 4 GB) + firewall
```bash
ssh root@SEU_IP
apt update && apt -y upgrade

# SWAP — segura picos de RAM (Evolution/Baileys é faminto). Pule só se tiver >= 8 GB.
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf
free -h   # confirmar 4 Gi de swap

# firewall: so 22/80/443
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. Docker + Node + Caddy + pm2
```bash
curl -fsSL https://get.docker.com | sh          # pule se o template ja traz Docker
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt -y install nodejs
apt -y install caddy
npm i -g pm2
```

## 3. Código + segredos
```bash
git clone https://SEU_TOKEN@github.com/pethrus07/zapagente.git
cd zapagente/apps/api && cp .env.example .env && nano .env
```
No `.env` de produção troque **todos** os segredos:
- `DATABASE_URL="postgresql://zapagente:<senha>@localhost:5432/zapagente?schema=public"` (a `<senha>` = `POSTGRES_PASSWORD` do passo 4).
- `JWT_SECRET` — `openssl rand -hex 32`.
- `EVOLUTION_API_KEY` — forte (bate com o compose).
- `OPENAI_API_KEY` — a chave do parceiro. `IA_PROVIDER=openai`, `EMBEDDINGS_PROVIDER=openai`.
- `WEBHOOK_SECRET` — `openssl rand -hex 16`.
- `WEBHOOK_URL="http://host.docker.internal:3000/webhook/<WEBHOOK_SECRET>"` (o mesmo segredo).
- `CORS_ORIGIN="https://seu-dominio"`.

## 4. Infra (caminho ENXUTO — 4 GB) + banco + RAG
```bash
cd ~/zapagente
# senha do Postgres do app (defina uma forte); o mesmo valor vai no DATABASE_URL
export POSTGRES_PASSWORD='troque-forte'
docker compose -f infra/docker-compose.demo.yml up -d   # 1 Postgres (app + evolution) + evolution + redis

cd apps/api && npm ci
npx prisma migrate deploy && npx prisma generate
npx tsx scripts/backfill-rag.mts    # indexa o conhecimento p/ o RAG
```
> Em VPS **>= 8 GB**, use `infra/docker-compose.yml` (Postgres separado da Evolution) no lugar do `.demo.yml`.

## 5. Build — de preferência LOCAL (não no server de 1 vCPU)
O build (`tsc`/`vite`) é pesado pra 1 núcleo. **Recomendado:** buíde no seu PC e suba o `dist`.
- **API:** no server, `npm run build` funciona (só é lento) — com swap ativo, ok. Ou buíde local e `scp` o `apps/api/dist`.
- **Painel:** `cd apps/painel && npm ci && npm run build` → serve `apps/painel/dist` (ou buíde local e `scp`).

## 6. Subir a API (reinicia sozinha, sobe no boot)
```bash
cd ~/zapagente/apps/api
pm2 start npm --name zapagente-api -- start
pm2 startup && pm2 save
```
A API já inicia o **worker anti-bloqueio** + o **agendador** de missões programadas.

## 7. Painel + HTTPS (Caddy)
```bash
cp ~/zapagente/infra/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile     # troque painel.seudominio.com pelo seu domínio/hostname
systemctl reload caddy        # HTTPS automatico (Let's Encrypt)
```

## 8. Conectar o WhatsApp
Abra `https://SEU_DOMINIO` → login super-admin → **troque a senha** → **Números** → cadastra o chip → **QR** → escaneia. Manda uma mensagem de teste e vê a IA responder.

---

## P0 de segurança / operação (não pular)
- **Postgres/Evolution só em `127.0.0.1`** (já no compose). Confirme: `ss -tlnp | grep -E '8080|5432'` → deve mostrar `127.0.0.1`.
- **Webhook com segredo:** `WEBHOOK_URL` tem que ter o `/<WEBHOOK_SECRET>` no fim.
- **Backup do Postgres** (com 1 banco, os dois DBs saem juntos com `pg_dumpall`):
  ```bash
  (crontab -l 2>/dev/null; echo "0 3 * * * docker exec zapagente-db pg_dumpall -U zapagente | gzip > /root/backup-\$(date +\%F).sql.gz") | crontab -
  ```
- **Teto de gasto na OpenAI** (a key é única do parceiro) — limite + alerta na conta.
- **Segredos:** nenhum default (JWT / Postgres / Evolution / webhook).

## No 4 GB — o que monitorar
- `free -h` e `docker stats` nas primeiras horas. Se a RAM+swap encostar no teto, o sintoma é lentidão ou um container reiniciando (`docker ps` mostra `Restarting`).
- 1 chip só. Não rode builds pesados com o sistema no ar.

## Atualizar depois
```bash
cd ~/zapagente && git pull
cd apps/api && npm ci && npx prisma migrate deploy && npm run build && pm2 restart zapagente-api
cd ../painel && npm ci && npm run build   # Caddy já serve o dist novo
```
