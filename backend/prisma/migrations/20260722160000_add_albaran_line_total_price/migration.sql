-- AlbaranLine.totalPrice: importe neto de la línea (sin IVA, con descuento si lo
-- hay) tal como lo lee el OCR del papel. Hasta ahora se descartaba porque el
-- backend recalculaba lineAmount = qty × unit_price (bruto), que no cuadra con
-- el papel cuando el proveedor aplica un descuento.
ALTER TABLE "albaran_lines" ADD COLUMN "totalPrice" DOUBLE PRECISION;

-- Albaran.applyDiscountToCost: opt-in (default false) para que, al confirmar el
-- albarán, el precio de compra y los escandallos usen el precio unitario neto
-- (totalPrice / qty) en lugar del bruto. No cambia el comportamiento existente
-- salvo que el usuario lo active explícitamente.
ALTER TABLE "albaranes" ADD COLUMN "applyDiscountToCost" BOOLEAN NOT NULL DEFAULT false;
