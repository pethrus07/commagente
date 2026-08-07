-- Pausar/retomar campanha: enquanto pausada, a IA não envia nem responde nas missões dela
-- (histórico preservado; retoma de onde parou).
ALTER TABLE "campanhas" ADD COLUMN "pausada" BOOLEAN NOT NULL DEFAULT false;
