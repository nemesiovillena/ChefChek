'use client';

import { useState, useEffect, useCallback } from 'react';
import { checkAlbaranDuplicate, type AlbaranDuplicateMatch } from '@/lib/api-albaran';

/**
 * Aviso advisory de duplicados por número de albarán + proveedor.
 *
 * No bloquea el alta (ni manual ni OCR): solo informa para que el usuario
 * decida si es el mismo albarán ya cargado o uno distinto. `excludeId` evita
 * el falso positivo del propio albarán al editar.
 *
 * Toda mutación de estado va dentro de `check` (useCallback), invocada desde
 * el `setTimeout` del effect — mismo convenio que useProductNameCheck.
 */
export function useAlbaranDuplicateCheck(
  supplierId: string | undefined,
  albaranNumber: string,
  excludeId?: string,
  debounceMs = 350,
): { match: AlbaranDuplicateMatch | null; loading: boolean } {
  const [match, setMatch] = useState<AlbaranDuplicateMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const trimmed = albaranNumber.trim();

  const check = useCallback(
    async (supplier: string | undefined, number: string, excl?: string) => {
      if (!supplier || number.length < 1) {
        setMatch(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await checkAlbaranDuplicate(supplier, number, excl);
        setMatch(result);
      } catch {
        setMatch(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      check(supplierId, trimmed, excludeId);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [supplierId, trimmed, excludeId, debounceMs, check]);

  return { match, loading };
}
