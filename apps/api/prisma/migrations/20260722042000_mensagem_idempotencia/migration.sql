-- idempotência: evita gravar a mesma mensagem 2× (providerMsgId por tenant).
-- NULLs são distintos no Postgres, então mensagens sem provider_msg_id não colidem.
CREATE UNIQUE INDEX "mensagens_tenant_id_provider_msg_id_key" ON "mensagens"("tenant_id", "provider_msg_id");
