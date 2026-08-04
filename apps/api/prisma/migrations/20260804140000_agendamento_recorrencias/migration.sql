-- Recorrências completas do agendamento (diário, a-cada-X, semanal, anual, dias úteis…),
-- + data de início/fim, horário e máximo de execuções. [parceiro Item 3]
ALTER TABLE "agendamentos" ADD COLUMN "intervalo" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN "dias_semana" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN "horario" TEXT;
ALTER TABLE "agendamentos" ADD COLUMN "data_inicio" TIMESTAMP(3);
ALTER TABLE "agendamentos" ADD COLUMN "data_fim" TIMESTAMP(3);
ALTER TABLE "agendamentos" ADD COLUMN "max_execucoes" INTEGER;
ALTER TABLE "agendamentos" ADD COLUMN "execucoes" INTEGER NOT NULL DEFAULT 0;
