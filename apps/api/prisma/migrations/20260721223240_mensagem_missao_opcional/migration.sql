-- DropForeignKey
ALTER TABLE "mensagens" DROP CONSTRAINT "mensagens_missao_id_fkey";

-- AlterTable
ALTER TABLE "mensagens" ALTER COLUMN "missao_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "missoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
