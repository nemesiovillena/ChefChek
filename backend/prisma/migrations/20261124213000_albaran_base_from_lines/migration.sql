-- Rellena la base imponible y el bruto de los albaranes que los tienen a 0
-- (el OCR no leyó la base del papel) sumando sus líneas no rechazadas, con la
-- misma regla que la app: neto del papel si trae descuento (más cerca de 0
-- que cantidad × precio), si no cantidad × precio; redondeo por línea.
-- Solo toca albaranes con base = 0 y con líneas; el IVA y el total no cambian.
UPDATE "albaranes" AS a
SET
  "base" = sub.base,
  "grossAmount" = CASE WHEN a."grossAmount" = 0 THEN sub.gross ELSE a."grossAmount" END
FROM (
  SELECT
    l."albaranId",
    SUM(ROUND((CASE
      WHEN l."totalPrice" IS NOT NULL
        AND ABS(l."totalPrice") < ABS(l."quantity" * l."unitPrice")
      THEN l."totalPrice"
      ELSE l."quantity" * l."unitPrice"
    END)::numeric, 2))::float8 AS base,
    SUM(ROUND((l."quantity" * l."unitPrice")::numeric, 2))::float8 AS gross
  FROM "albaran_lines" AS l
  WHERE l."lineStatus" <> 'RECHAZADO'
  GROUP BY l."albaranId"
) AS sub
WHERE sub."albaranId" = a."id"
  AND a."base" = 0
  AND sub.base <> 0;
