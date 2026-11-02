-- Las horas pactadas dejan de ponerse a 40 en silencio: una ficha nueva queda
-- «sin pactar» hasta que alguien las rellena. Los valores existentes se conservan.
ALTER TABLE "employees" ALTER COLUMN "weeklyHours" DROP NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "weeklyHours" DROP DEFAULT;
