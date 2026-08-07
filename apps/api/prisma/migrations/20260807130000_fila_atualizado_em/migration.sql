-- Carimbo de update na fila (para o reaper seguro): só recupera 'enviando' órfão de verdade,
-- não um envio em curso. Preenche as linhas existentes com criado_em (ou now()).
ALTER TABLE "fila_envio" ADD COLUMN "atualizado_em" TIMESTAMP(3);
UPDATE "fila_envio" SET "atualizado_em" = COALESCE("criado_em", now()) WHERE "atualizado_em" IS NULL;
ALTER TABLE "fila_envio" ALTER COLUMN "atualizado_em" SET NOT NULL;
ALTER TABLE "fila_envio" ALTER COLUMN "atualizado_em" SET DEFAULT CURRENT_TIMESTAMP;
