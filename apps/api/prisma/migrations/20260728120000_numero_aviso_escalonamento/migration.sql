-- Aviso de escalonamento no WhatsApp (self-send validado): avisa o operador quando escala.
ALTER TABLE "numeros_whatsapp" ADD COLUMN "avisar_escalonamento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "numeros_whatsapp" ADD COLUMN "numero_aviso" TEXT;
