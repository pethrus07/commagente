-- DNA do contato: conhecimento estruturado sobre a PESSOA (perfil/comunicação/histórico/observações).
-- Personalização, não fonte de fato. Monta sobre o DNA do tenant (#4). Aditivo e opcional.
ALTER TABLE "contatos" ADD COLUMN "dna" JSONB;
