-- Fase C do DNA hierárquico (§9): camada de DNA por missão.
-- {categoria: {modo:'substituir'|'combinar', texto}} — vence a campanha e o tenant naquela conversa.
ALTER TABLE "missoes" ADD COLUMN "dna" JSONB;
