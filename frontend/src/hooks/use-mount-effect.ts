import { useEffect } from 'react';

/**
 * Único useEffect permitido: sincronizar con un sistema externo al montar y
 * limpiar al desmontar (suscripciones, temporizadores…).
 */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
