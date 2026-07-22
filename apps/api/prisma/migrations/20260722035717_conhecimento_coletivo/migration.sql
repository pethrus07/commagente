-- CreateEnum
CREATE TYPE "StatusConhecimento" AS ENUM ('sugerido', 'aprovado', 'rejeitado');

-- CreateTable
CREATE TABLE "conhecimento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status" "StatusConhecimento" NOT NULL DEFAULT 'aprovado',
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "missao_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conhecimento_tenant_id_status_idx" ON "conhecimento"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "conhecimento" ADD CONSTRAINT "conhecimento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
