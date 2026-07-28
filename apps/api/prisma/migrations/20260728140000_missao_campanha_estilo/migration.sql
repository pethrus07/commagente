-- Perfil de conversa por missão (e por campanha, herdado pelas missões dela).
ALTER TABLE "missoes" ADD COLUMN "estilo" JSONB;
ALTER TABLE "campanhas" ADD COLUMN "estilo" JSONB;
