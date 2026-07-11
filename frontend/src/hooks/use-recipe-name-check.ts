'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';

export interface RecipeNameMatch {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Aviso advisory de duplicados por nombre (Recetas).
 *
 * Busca recetas del tenant cuyo nombre coincide con el introducido, ignorando
 * mayúsculas, espacios y acentos (ej: "Paella" = "Paëlla " = "PAELLA"). No
 * bloquea la creación: solo informa para que el usuario decida si es la misma
 * receta o una distinta.
 *
 * `excludeId` evita el falso positivo de la propia receta al editar.
 *
 * Toda mutación de estado va dentro de `checkName` (useCallback), invocada
 * desde el `setTimeout` del effect — así ningún setState es síncrono en el
 * cuerpo del effect (regla react-hooks/set-state-in-effect). Mismo convenio
 * que useProductSearch / useProductNameCheck. El interceptor global de
 * apiClient desenvuelve { success, data } → response.data es ya el array.
 */
export function useRecipeNameCheck(
  name: string,
  excludeId?: string,
  debounceMs = 350,
): { matches: RecipeNameMatch[]; loading: boolean } {
  const [matches, setMatches] = useState<RecipeNameMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = name.trim();

  const checkName = useCallback(async (query: string, excl?: string) => {
    if (query.length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get<RecipeNameMatch[]>(
        '/v1/recipes/check-name',
        { params: { name: query, excludeId: excl } },
      );
      setMatches(Array.isArray(response.data) ? response.data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkName(trimmed, excludeId);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [trimmed, excludeId, debounceMs, checkName]);

  return { matches, loading };
}
