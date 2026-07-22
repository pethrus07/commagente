-- AlterTable
ALTER TABLE "missoes" ADD COLUMN     "ia_pausada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivo_escala" TEXT;
