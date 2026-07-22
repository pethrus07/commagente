-- Suporte reativo por número (a IA atende inbound sem missão prévia)
ALTER TABLE "numeros_whatsapp"
  ADD COLUMN "suporte_reativo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "suporte_objetivo" TEXT,
  ADD COLUMN "suporte_tom" TEXT,
  ADD COLUMN "suporte_informacoes" TEXT,
  ADD COLUMN "suporte_criterio" TEXT,
  ADD COLUMN "suporte_modo" TEXT NOT NULL DEFAULT 'auto';
