-- Persona / identidade da IA por tenant (voz da marca; sempre no prompt de toda missão).
ALTER TABLE "tenants" ADD COLUMN "persona" TEXT;
