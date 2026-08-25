-- Modo Roteiro (§FactoryHub): sequência guiada por campanha + progresso por missão.
-- Aditivo: 2 colunas JSONB nulas. (As colunas de follow-up nunca chegaram ao banco — só existiam
-- no schema; foram removidas do schema pra alinhar schema↔banco, sem DROP porque não existiam.)
ALTER TABLE "campanhas" ADD COLUMN "roteiro" JSONB;
ALTER TABLE "missoes" ADD COLUMN "roteiro_estado" JSONB;
