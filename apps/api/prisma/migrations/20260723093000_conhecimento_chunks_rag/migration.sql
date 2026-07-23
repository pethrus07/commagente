-- RAG: chunks vetorizados do conhecimento (recuperação por relevância).
-- CreateTable
CREATE TABLE "conhecimento_chunks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conhecimento_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "conteudo" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conhecimento_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conhecimento_chunks_tenant_id_idx" ON "conhecimento_chunks"("tenant_id");

-- AddForeignKey
ALTER TABLE "conhecimento_chunks" ADD CONSTRAINT "conhecimento_chunks_conhecimento_id_fkey" FOREIGN KEY ("conhecimento_id") REFERENCES "conhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
