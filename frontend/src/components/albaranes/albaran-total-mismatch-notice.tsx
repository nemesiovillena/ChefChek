import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTotalMismatch } from '@/lib/albaran-total-check';
import type { Albaran } from '@/lib/api-albaran';

const formatEur = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Aviso (no bloquea) de que lo que suman las líneas con su IVA no coincide con
 * el total leído del papel: casi siempre un tipo de IVA o un importe mal leído.
 * Se muestra mientras aún tiene arreglo: antes de confirmar (edición normal) y
 * en confirmado (corrección con el lápiz). `children` añade una acción.
 */
export function AlbaranTotalMismatchNotice({
  albaran,
  children,
}: {
  albaran: Albaran;
  children?: ReactNode;
}) {
  if (albaran.status === 'ARCHIVADO') return null;
  const mismatch = getTotalMismatch(albaran);
  if (!mismatch) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>
          Las líneas suman <strong>{formatEur(mismatch.computed)}</strong> con IVA, pero el total del
          albarán es <strong>{formatEur(mismatch.paper)}</strong>.{' '}
          {albaran.status === 'CONFIRMADO'
            ? 'Corrige el IVA o el precio de la línea equivocada con el lápiz.'
            : 'Revisa el IVA y los importes de las líneas antes de confirmar.'}
        </p>
        {children}
      </div>
    </div>
  );
}
