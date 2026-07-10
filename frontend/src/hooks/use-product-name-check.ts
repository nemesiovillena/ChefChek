'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';

export interface ProductNameMatch {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Aviso advisory de duplicados por nombre.
 *
 * Busca artículos del tenant cuyo nombre coincide con el introducido,
 * ignorando mayúsculas, espacios y acentos (ej: "Tomate" = "Tomáte " =
 * "JAMÓN"). No bloquea la creación: solo informa para que el usuario decida
 * si es el mismo artículo o uno distinto.
 *
 * `excludeId` evita el falso positivo del propio artículo al editar.
 *
 * Toda mutación de estado va dentro de `checkName` (useCallback), invocada
 * desde el `setTimeout` del effect — así ningún setState es síncrono en el
 * cuerpo del effect (regla react-hooks/set-state-in-effect). Mismo convenio
 * que useProductSearch. El interceptor global de apiClient desenvuelve
 * { success, data } → response.data es ya el array de coincidencias.
 */
export function useProductNameCheck(
  name: string,
  excludeId?: string,
  debounceMs = 350,
): { matches: ProductNameMatch[]; loading: boolean } {
  const [matches, setMatches] = useState<ProductNameMatch[]>([]);
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
      const response = await apiClient.get<ProductNameMatch[]>(
        '/v1/products/check-name',
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
