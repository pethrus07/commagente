-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "opt_in_em" TIMESTAMP(3),
ADD COLUMN     "opt_in_origem" TEXT,
ADD COLUMN     "opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opt_out_em" TIMESTAMP(3);
