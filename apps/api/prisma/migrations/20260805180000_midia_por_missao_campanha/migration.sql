-- Fase A do DNA hierárquico (§9): mídia curada por missão / campanha / agendamento.
-- Vazio ([]) = comportamento atual (toda a biblioteca do tenant fica disponível à IA).
ALTER TABLE "missoes" ADD COLUMN "midia_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "campanhas" ADD COLUMN "midia_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "agendamentos" ADD COLUMN "midia_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
