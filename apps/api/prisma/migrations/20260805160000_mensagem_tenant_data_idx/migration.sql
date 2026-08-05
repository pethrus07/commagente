-- Monitoramento ao vivo (§8.10): índice p/ as agregações por tenant/data (msgs de hoje, última).
-- Evita full-table scan da tabela mensagens no auto-refresh do painel de super-admin.
CREATE INDEX "mensagens_tenant_id_criada_em_idx" ON "mensagens"("tenant_id", "criada_em");
