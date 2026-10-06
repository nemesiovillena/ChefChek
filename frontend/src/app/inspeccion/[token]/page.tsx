'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { MONTH_NAMES } from '@/lib/check-in-punch';
import type { InspectionSummary, ReportFormat } from '@/lib/check-in-types';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const FORMATS: { format: ReportFormat; label: string }[] = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
];

/**
 * Página pública para la Inspección de Trabajo: quien tenga el enlace puede
 * descargar el registro de jornada de los meses que cubre, sin cuenta. No usa
 * apiClient a propósito: aquí no hay sesión ni cabecera de tenant, la única
 * credencial es el token de la URL.
 */
export default function InspectionPage() {
  const { token } = useParams<{ token: string }>();
  const base = `${API_BASE_URL}/v1/check-in/inspection/${token}`;

  const { data, isLoading, isError } = useQuery<InspectionSummary>({
    queryKey: ['inspection', token],
    queryFn: async () => {
      const response = await fetch(base);
      if (!response.ok) throw new Error('invalid');
      const body = await response.json();
      return body.data ?? body;
    },
    retry: false,
  });

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-[var(--surface)] p-4 text-[var(--on-surface)] md:p-8">
      <p className="text-sm text-[var(--on-surface-variant)]">ChefChek · Registro de jornada</p>

      {isLoading && <p className="mt-6">Cargando…</p>}

      {isError && (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold">Enlace no válido o caducado</h1>
          <p className="mt-2 text-[var(--on-surface-variant)]">
            Pida a la empresa un enlace nuevo para consultar el registro de jornada.
          </p>
        </div>
      )}

      {data && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">{data.company.name}</h1>
          {data.company.taxId && <p className="text-[var(--on-surface-variant)]">CIF {data.company.taxId}</p>}
          <p className="mt-4">
            Registro diario de jornada de toda la plantilla (art. 34.9 del Estatuto de los Trabajadores). Cada documento
            incluye las horas de entrada y salida de cada día, las correcciones con su motivo y autor, y la comprobación
            de integridad del registro.
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Acceso de solo lectura, válido hasta el{' '}
            {new Date(data.expiresAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}.
          </p>

          <ul className="mt-6 divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
            {data.months.map(({ year, month }) => (
              <li key={`${year}-${month}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium capitalize">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
                <span className="flex flex-wrap gap-2">
                  {FORMATS.map(({ format, label }) => (
                    // Enlace directo: la descarga la hace el navegador, sin JavaScript de por medio.
                    <a
                      key={format}
                      href={`${base}/report?year=${year}&month=${month}&format=${format}`}
                      className="flex min-h-[44px] items-center gap-1 rounded-xl border border-[var(--outline-variant)] px-3 text-sm font-medium"
                    >
                      <Download className="h-4 w-4" /> {label}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
