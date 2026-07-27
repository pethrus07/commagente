-- Aceite dos termos no 1º login (LGPD/uso de dados + responsabilidade do número).
ALTER TABLE "usuarios" ADD COLUMN "aceitou_termos_em" TIMESTAMP(3);
