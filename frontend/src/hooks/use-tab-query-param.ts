'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Pestaña activa de una página guardada en la URL (`?tab=`), para que un
 * enlace pueda abrir directamente una pestaña concreta y que recargar o
 * volver atrás la conserve. La URL es la única fuente de verdad: un valor
 * desconocido cae en `fallback`.
 *
 * Usa `useSearchParams`: la página debe renderizarse dentro de `<Suspense>`.
 */
export function useTabQueryParam<T extends string>(allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = searchParams.get('tab');
  const active = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  function setActive(tab: T) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return [active, setActive];
}
