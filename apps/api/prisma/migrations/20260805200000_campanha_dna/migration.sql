-- Fase B do DNA hierárquico (§9): camada de DNA por campanha.
-- {categoria: {modo:'substituir'|'combinar', texto}} sobrescreve o DNA do tenant nas missões da campanha.
ALTER TABLE "campanhas" ADD COLUMN "dna" JSONB;
