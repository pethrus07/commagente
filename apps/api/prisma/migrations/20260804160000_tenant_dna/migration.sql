-- DNA do tenant: conhecimento categorizado da empresa (empresa/produtos/preços/regras/FAQ…).
-- Renomeia a "Voz da Marca" → DNA (a persona/voz segue no campo `persona`). Aditivo e opcional.
ALTER TABLE "tenants" ADD COLUMN "dna" JSONB;
