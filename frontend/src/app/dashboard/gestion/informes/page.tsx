'use client';

import Link from 'next/link';
import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GESTION_REPORTS } from '@/features/gestion/gestion-report-catalog';

/** Catálogo de informes de Gestión: cada tarjeta abre su informe. */
export default function GestionInformesPage() {
  return (
    <GestionPageShell>
      <div className="mb-3 text-sm font-semibold text-[var(--on-surface)]">Ventas</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GESTION_REPORTS.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/gestion/informes/${r.key}`}
            className="flex gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4 transition hover:bg-[var(--surface-container-high)]"
          >
            <span className="material-symbols-outlined text-[var(--primary)]">{r.icon}</span>
            <span>
              <span className="block font-medium text-[var(--on-surface)]">{r.title}</span>
              <span className="mt-0.5 block text-sm text-[var(--on-surface-variant)]">{r.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </GestionPageShell>
  );
}
