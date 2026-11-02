-- Plato de Cuiner vendido al peso: cada línea de venta resta una pieza.
ALTER TABLE "portion_counter_dishes" ADD COLUMN "perPiece" BOOLEAN NOT NULL DEFAULT false;
