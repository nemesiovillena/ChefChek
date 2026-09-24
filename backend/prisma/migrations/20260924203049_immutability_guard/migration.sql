-- Motor de checklist compartido (SICTED/APPCC) y evidencia SICTED propia:
-- guarda de inalterabilidad generica, reutilizable por cualquier tabla
-- append-only creada en fases posteriores (checklist_*, sicted_*). Esta
-- migracion solo crea las funciones; ninguna tabla existe aun para
-- adjuntarles el trigger (eso lo hacen las migraciones de fase 2/4/6-9,
-- una por cada tabla nueva: "CREATE TRIGGER ... EXECUTE FUNCTION
-- forbid_mutation()").
--
-- forbid_mutation(): bloquea UPDATE/DELETE salvo escape explicito via
-- `SET LOCAL chefchek.allow_evidence_purge = 'on'`. Solo lo activan dos
-- flujos de aplicacion: purge de tenant (superadmin) y restore de backup
-- con includeEvidenceTables=true (confirmacion explicita del usuario).
--
-- forbid_mutation_after_seal(): variante para filas "selladas" (p.ej. una
-- hoja de checklist ya supervisada) -- permite UPDATE mientras la columna
-- de sello ("supervisedAt", por convencion) sea NULL; una vez puesta, se
-- congela igual que forbid_mutation(). DELETE siempre bloqueado salvo el
-- mismo escape.

CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('chefchek.allow_evidence_purge', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Tabla % es evidencia inalterable: % no permitido (fila id=%)',
    TG_TABLE_NAME, TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_mutation_after_seal()
RETURNS trigger AS $$
BEGIN
  IF current_setting('chefchek.allow_evidence_purge', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Tabla % es evidencia inalterable: DELETE no permitido (fila id=%)',
      TG_TABLE_NAME, OLD.id;
  END IF;

  IF OLD."supervisedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Tabla % es evidencia sellada (supervisedAt=%): UPDATE no permitido (fila id=%)',
      TG_TABLE_NAME, OLD."supervisedAt", OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
