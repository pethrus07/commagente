-- CreateEnum
CREATE TYPE "EstadoMissao" AS ENUM ('configurada', 'na_fila', 'em_conversa', 'concluida', 'descartada', 'escalada', 'sem_resposta', 'arquivada');

-- CreateEnum
CREATE TYPE "Direcao" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('pendente', 'enviando', 'ok', 'erro');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('desconectado', 'conectando', 'conectado');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numeros_whatsapp" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "instancia_evolution" TEXT NOT NULL,
    "status_conexao" "StatusConexao" NOT NULL DEFAULT 'desconectado',
    "aquecimento_estagio" INTEGER NOT NULL DEFAULT 1,
    "budget_diario" INTEGER NOT NULL DEFAULT 10,
    "enviados_hoje" INTEGER NOT NULL DEFAULT 0,
    "janela_inicio" TEXT NOT NULL DEFAULT '08:00',
    "janela_fim" TEXT NOT NULL DEFAULT '20:00',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numeros_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "dados" JSONB,
    "origem" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missao_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "persona_prompt" TEXT NOT NULL,
    "tom" TEXT,
    "criterio_conclusao" TEXT,
    "categorias" JSONB,
    "guardrails" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missao_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missoes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contato_id" UUID NOT NULL,
    "template_id" UUID,
    "numero_id" UUID NOT NULL,
    "objetivo" TEXT NOT NULL,
    "contexto" TEXT,
    "estado" "EstadoMissao" NOT NULL DEFAULT 'configurada',
    "categoria_resultado" TEXT,
    "resumo" TEXT,
    "fatos" JSONB,
    "iniciada_em" TIMESTAMP(3),
    "concluida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "missao_id" UUID NOT NULL,
    "contato_id" UUID NOT NULL,
    "direcao" "Direcao" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status_envio" "StatusEnvio",
    "provider_msg_id" TEXT,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMP(3),

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_envio" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "missao_id" UUID NOT NULL,
    "contato_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "agendado_para" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusEnvio" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "missao_id" UUID,
    "tipo" TEXT NOT NULL,
    "dados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "numeros_whatsapp_tenant_id_idx" ON "numeros_whatsapp"("tenant_id");

-- CreateIndex
CREATE INDEX "contatos_tenant_id_idx" ON "contatos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_tenant_id_telefone_key" ON "contatos"("tenant_id", "telefone");

-- CreateIndex
CREATE INDEX "missao_templates_tenant_id_idx" ON "missao_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "missoes_tenant_id_estado_idx" ON "missoes"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "mensagens_missao_id_criada_em_idx" ON "mensagens"("missao_id", "criada_em");

-- CreateIndex
CREATE INDEX "fila_envio_status_agendado_para_idx" ON "fila_envio"("status", "agendado_para");

-- CreateIndex
CREATE INDEX "eventos_tenant_id_criado_em_idx" ON "eventos"("tenant_id", "criado_em");

-- AddForeignKey
ALTER TABLE "numeros_whatsapp" ADD CONSTRAINT "numeros_whatsapp_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missao_templates" ADD CONSTRAINT "missao_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes" ADD CONSTRAINT "missoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes" ADD CONSTRAINT "missoes_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes" ADD CONSTRAINT "missoes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "missao_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missoes" ADD CONSTRAINT "missoes_numero_id_fkey" FOREIGN KEY ("numero_id") REFERENCES "numeros_whatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_envio" ADD CONSTRAINT "fila_envio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_envio" ADD CONSTRAINT "fila_envio_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "missoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_envio" ADD CONSTRAINT "fila_envio_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "missoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
