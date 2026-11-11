-- Comensales pasa a texto libre («17 adultos y 5 niños»).
-- Conversión sin pérdida: los números existentes quedan como texto (12 → '12').
ALTER TABLE "sala_tasks" ALTER COLUMN "guestCount" TYPE TEXT USING "guestCount"::text;
