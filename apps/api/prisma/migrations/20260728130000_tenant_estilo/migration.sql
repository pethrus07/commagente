-- Estilo de conversa do tenant (JSON): formalidade, emoji, abreviação, travessão, bolhas.
ALTER TABLE "tenants" ADD COLUMN "estilo" JSONB;
