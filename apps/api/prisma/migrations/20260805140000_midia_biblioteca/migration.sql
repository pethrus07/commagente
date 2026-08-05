-- Biblioteca de mídia: arquivos que a IA pode enviar ao contato (catálogo, tabela de preço…). [§8.15]
CREATE TABLE "midia" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "nome"      TEXT NOT NULL,
  "mimetype"  TEXT NOT NULL,
  "tamanho"   INTEGER NOT NULL,
  "dados"     BYTEA NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "midia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "midia_tenant_id_idx" ON "midia"("tenant_id");
ALTER TABLE "midia" ADD CONSTRAINT "midia_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
