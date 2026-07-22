-- AlterTable
ALTER TABLE "missoes" ADD COLUMN     "campanha_id" UUID;

-- CreateTable
CREATE TABLE "campanhas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'vender',
    "objetivo" TEXT NOT NULL,
    "contexto" TEXT,
    "criterio_conclusao" TEXT,
    "tom" TEXT,
    "informacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campanhas_tenant_id_idx" ON "campanhas"("tenant_id");

-- CreateIndex
CREATE INDEX "missoes_campanha_id_idx" ON "missoes"("campanha_id");

-- AddForeignKey
ALTER TABLE "missoes" ADD CONSTRAINT "missoes_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_numero_id_fkey" FOREIGN KEY ("numero_id") REFERENCES "numeros_whatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
