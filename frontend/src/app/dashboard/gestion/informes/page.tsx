'use client';

import Link from 'next/link';
import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GESTION_REPORTS, REPORT_GROUPS } from '@/features/gestion/gestion-report-catalog';

/** Catálogo de informes de Gestión: cada tarjeta abre su informe. */
export default function GestionInformesPage() {
  return (
    <GestionPageShell>
      {REPORT_GROUPS.map((group) => (
        <section key={group} className="mb-6">
          <div className="mb-3 text-sm font-semibold text-[var(--on-surface)]">{group}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GESTION_REPORTS.filter((r) => r.group === group).map((r) => (
              <Link
                key={r.key}
                href={`/dashboard/gestion/informes/${r.key}`}
                className="flex gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4 transition hover:bg-[var(--surface-container-high)]"
              >
                <r.icon aria-hidden className="h-6 w-6 text-[var(--primary)]" />
                <span>
                  <span className="block font-medium text-[var(--on-surface)]">{r.title}</span>
                  <span className="mt-0.5 block text-sm text-[var(--on-surface-variant)]">{r.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </GestionPageShell>
  );
}
