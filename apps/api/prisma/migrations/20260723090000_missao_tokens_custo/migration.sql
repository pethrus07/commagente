-- Instrumentação de custo: tokens acumulados por missão (só super-admin vê no painel).
ALTER TABLE "missoes" ADD COLUMN "tokens_entrada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "missoes" ADD COLUMN "tokens_saida" INTEGER NOT NULL DEFAULT 0;
