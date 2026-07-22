-- AlterTable
ALTER TABLE "missoes" ADD COLUMN     "criterio_conclusao" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'vender';
