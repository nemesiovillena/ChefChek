'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { listZebraPrinters, type ZebraDevice } from '@/lib/zebra-browser-print';
import { getPreferredZebraDeviceUid } from '@/hooks/use-food-labels';

const POLL_MS = 5_000;

/**
 * ¿Aparece por USB la impresora a la que van las etiquetas? Con una guardada
 * en Configuración, esa; si no, cualquier Zebra USB (la cola del driver de
 * Windows sigue en la lista con la impresora apagada, así que no cuenta).
 */
function targetConnected(devices: ZebraDevice[]): boolean {
  const preferred = getPreferredZebraDeviceUid();
  return preferred
    ? devices.some((d) => d.uid === preferred)
    : devices.some((d) => d.connection === 'usb');
}

/**
 * Indicador junto al botón de imprimir: «Impresora lista» o «Preparando…».
 * Solo pide la lista de impresoras a Browser Print (no escribe en la Zebra),
 * así que se puede consultar cada pocos segundos sin riesgo. Tras encender la
 * impresora pasa a «lista» cuando Browser Print termina de reiniciarse.
 */
export function ZebraReadyBadge() {
  const { data: ready, isPending } = useQuery({
    queryKey: ['zebra-ready'],
    queryFn: async () => {
      try {
        return targetConnected(await listZebraPrinters());
      } catch {
        return false;
      }
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });

  if (isPending) return null;
  return ready ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      Impresora lista
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--on-surface-variant)]">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Impresora apagada o preparándose…
    </span>
  );
}
