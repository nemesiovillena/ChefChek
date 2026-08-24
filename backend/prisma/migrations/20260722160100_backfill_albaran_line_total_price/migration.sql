-- Backfill idempotente de AlbaranLine.totalPrice para albaranes OCR ya importados:
-- recupera el importe neto de cada línea (sin IVA, con descuento) tal como lo
-- leyó el OCR del papel, emparejando por lineOrder (orden del documento).
-- Las nuevas importaciones ya lo persisten desde createFromUpload.
-- Idempotente: re-ejecutar simplemente reescribe los mismos valores.
WITH src AS (
  SELECT a.id AS albaran_id, (p.ord - 1) AS line_order,
         NULLIF(p.prod->>'total_price', '')::double precision AS total_price
  FROM albaranes a,
       jsonb_array_elements(a."ocrRawData"::jsonb->'products') WITH ORDINALITY AS p(prod, ord)
  WHERE a."ocrRawData" IS NOT NULL
    AND jsonb_typeof(a."ocrRawData"::jsonb->'products') = 'array'
)
UPDATE albaran_lines l
SET "totalPrice" = src.total_price
FROM src
WHERE l."albaranId" = src.albaran_id
  AND l."lineOrder" = src.line_order;
