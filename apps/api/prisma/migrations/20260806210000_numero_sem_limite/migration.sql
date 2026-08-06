-- Modo teste (sem freio anti-ban) por número: bypassa janela/budget/anti-rajada/saúde/anti-spam.
ALTER TABLE "numeros" ADD COLUMN "sem_limite" BOOLEAN NOT NULL DEFAULT false;
