-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "modo" TEXT NOT NULL DEFAULT 'auto';

-- AlterTable
ALTER TABLE "missoes" ADD COLUMN     "modo" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "rascunho" TEXT;
