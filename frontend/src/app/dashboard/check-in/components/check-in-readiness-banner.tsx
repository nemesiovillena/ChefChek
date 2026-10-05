'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useCheckInReadiness } from '@/hooks/use-check-in';

/** Aviso mientras falten textos legales por validar: sin eso no se puede fichar. */
export function CheckInReadinessBanner({ withLink = true }: { withLink?: boolean }) {
  const { data } = useCheckInReadiness();
  if (!data || data.ready) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] p-4 text-[var(--on-error-container)]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">Configuración pendiente: todavía no se puede fichar</p>
        <p className="text-sm">
          Faltan {data.missing.length} texto{data.missing.length === 1 ? '' : 's'} legal
          {data.missing.length === 1 ? '' : 'es'} por revisar y validar.{' '}
          {withLink && (
            <Link href="/dashboard/check-in/configuracion?tab=textos" className="underline">
              Ir a Textos legales
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
