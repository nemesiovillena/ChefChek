-- Puente ud<->kg en recepción: peso medio por unidad aprendido + trazabilidad
-- de lo recibido en la unidad original del albarán.
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "avgUnitWeight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "receivedSourceQuantity" DOUBLE PRECISION,
ADD COLUMN     "receivedSourceUnit" TEXT;
