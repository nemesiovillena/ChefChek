'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CuinerSalesReportTab } from '@/app/dashboard/cuiner/components/cuiner-sales-report-tab';
import { GESTION_BASE } from '@/features/gestion/api/gestion-api';
import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GestionReportView } from '@/features/gestion/components/gestion-report-view';
import { findReport } from '@/features/gestion/gestion-report-catalog';

/** Un informe de Gestión. «ventas» es el informe por familias que ya tenía Cuiner. */
export default function GestionInformePage() {
  const { key } = useParams<{ key: string }>();
  const report = findReport(key);
  return (
    <GestionPageShell>
      <Link
        href="/dashboard/gestion/informes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
      >
        <ArrowLeft className="h-4 w-4" /> Informes
      </Link>
      {!report ? (
        <p className="text-[var(--on-surface-variant)]">Ese informe no existe.</p>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-lg font-semibold text-[var(--on-surface)]">{report.title}</div>
            <p className="text-sm text-[var(--on-surface-variant)]">{report.description}</p>
          </div>
          {report.key === 'ventas' ? (
            <CuinerSalesReportTab endpoint={`${GESTION_BASE}/reports/ventas`} />
          ) : (
            <GestionReportView key={report.key} report={report} />
          )}
        </>
      )}
    </GestionPageShell>
  );
}
