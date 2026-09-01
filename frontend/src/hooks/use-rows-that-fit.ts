'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

// Altura estimada de fila (px) mientras aún no hay una fila real que medir:
// evita un primer render con muy pocas filas antes de la medición.
const FALLBACK_ROW_HEIGHT = 96;

/**
 * Calcula cuántas filas de altura aproximadamente uniforme caben enteras en un
 * contenedor de altura fija (p. ej. un panel `flex-1` dentro de una card cuya
 * altura la impone su columna). Mide la altura real del contenedor y la de su
 * primera fila y se re-evalúa ante cualquier resize vía `ResizeObserver`.
 *
 * Uso:
 *   const { ref, rows } = useRowsThatFit(4);
 *   <div ref={ref} key={loading ? 'l' : 'r'}>{items.slice(0, rows).map(...)}</div>
 *
 * El `key` que cambia al terminar la carga fuerza el re-attach del ref cuando
 * las filas reales sustituyen al placeholder, disparando una nueva medición.
 *
 * SSR y primer paint (antes de medir): devuelve `min`.
 */
export function useRowsThatFit(min: number) {
  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const rowsRef = useRef(min);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const firstRow = el.firstElementChild as HTMLElement | null;
    const rowHeight = firstRow?.getBoundingClientRect().height || FALLBACK_ROW_HEIGHT;
    const next =
      rowHeight > 0 ? Math.max(min, Math.floor(el.clientHeight / rowHeight)) : min;
    if (next !== rowsRef.current) {
      rowsRef.current = next;
      listenersRef.current.forEach((listener) => listener());
    }
  }, [min]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const listeners = listenersRef.current;
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => rowsRef.current, []);
  const getServerSnapshot = useCallback(() => min, [min]);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      containerRef.current = el;
      if (!el) return;

      const observer = new ResizeObserver(() => measure());
      observer.observe(el);
      if (el.firstElementChild) observer.observe(el.firstElementChild);
      observerRef.current = observer;
      measure();
    },
    [measure],
  );

  const rows = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { ref, rows };
}
