-- Interruptor «Ficha» por persona: desmarcado no sale en el kiosco ni ficha.
ALTER TABLE "employees" ADD COLUMN "punchEnabled" BOOLEAN NOT NULL DEFAULT true;
