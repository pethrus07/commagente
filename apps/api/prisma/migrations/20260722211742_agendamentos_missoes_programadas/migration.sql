-- CreateTable
CREATE TABLE "agendamentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contato_id" UUID NOT NULL,
    "numero_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'cobrar',
    "modo" TEXT NOT NULL DEFAULT 'auto',
    "objetivo" TEXT NOT NULL,
    "contexto" TEXT,
    "criterio_conclusao" TEXT,
    "tom" TEXT,
    "informacoes" TEXT,
    "recorrencia" TEXT NOT NULL DEFAULT 'mensal',
    "dia_do_mes" INTEGER,
    "data_unica" TIMESTAMP(3),
    "entrega" TEXT NOT NULL DEFAULT 'ia',
    "mensagem_fixa" TEXT,
    "rotulo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pular_ciclo_ref" TEXT,
    "ultimo_ciclo_ref" TEXT,
    "ultimo_disparo_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agendamentos_tenant_id_idx" ON "agendamentos"("tenant_id");

-- CreateIndex
CREATE INDEX "agendamentos_ativo_idx" ON "agendamentos"("ativo");

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_numero_id_fkey" FOREIGN KEY ("numero_id") REFERENCES "numeros_whatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
