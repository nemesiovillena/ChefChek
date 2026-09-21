-- Añade los perfiles térmicos por defecto (60×40 principal, 57×32 compacto) a
-- los tenants que ya guardaron su propia lista de perfiles: los tenants sin
-- fila reciben los defaults en lectura. Solo aditivo: no toca perfiles
-- existentes, se salta un tamaño o id que el tenant ya tenga y deja intactas
-- las filas con JSON inválido (la app ya cae a los defaults con ellas).
DO $$
DECLARE
  r RECORD;
  arr jsonb;
  d RECORD;
BEGIN
  FOR r IN
    SELECT id, value FROM "configurations" WHERE key = 'ETIQUETADO_THERMAL_PROFILES'
  LOOP
    BEGIN
      arr := r.value::jsonb;
      IF jsonb_typeof(arr) <> 'array' THEN
        CONTINUE;
      END IF;

      FOR d IN
        SELECT * FROM (VALUES
          ('default-60x40', 'Principal', 60, 40),
          ('default-57x32', 'Compacto', 57, 32)
        ) AS v(pid, pname, w, h)
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(arr) e
          WHERE e->>'id' = d.pid
             OR ((e->>'widthMm')::numeric = d.w AND (e->>'heightMm')::numeric = d.h)
        ) THEN
          arr := arr || jsonb_build_array(jsonb_build_object(
            'id', d.pid, 'name', d.pname, 'widthMm', d.w, 'heightMm', d.h, 'dpi', 203
          ));
        END IF;
      END LOOP;

      UPDATE "configurations" SET value = arr::text WHERE id = r.id;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;
END $$;
