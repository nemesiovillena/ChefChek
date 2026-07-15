'use client';

import { useState } from 'react';
import { FileClock, Loader2 } from 'lucide-react';
import { useCatalogImports } from '@/hooks/use-catalog-imports';
import { CatalogImportUploader } from './catalog-import-uploader';
import { CatalogImportReview } from './catalog-import-review';
import { SupplierComparisonTable } from './supplier-comparison-table';

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente de revisión',
  APLICADO: 'Aplicado',
  DESCARTADO: 'Descartado',
};

export function CatalogosTab() {
  const { data: imports, isLoading, error } = useCatalogImports();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <CatalogImportReview catalogImportId={selectedId} onDone={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="space-y-6">
      <CatalogImportUploader onCreated={setSelectedId} />

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
          <FileClock className="h-4 w-4" />
          Importaciones recientes
        </h2>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
            No se pudieron cargar las importaciones: {error.message}
          </div>
        )}
        {!isLoading && (imports ?? []).length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--on-surface-variant)]">
            Todavía no se ha subido ningún catálogo.
          </p>
        )}
        <ul className="space-y-2">
          {(imports ?? []).map((imp) => (
            <li key={imp.id}>
              <button
                onClick={() => setSelectedId(imp.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left transition hover:bg-[var(--surface-container-high)]"
              >
                <div>
                  <p className="font-medium text-[var(--on-surface)]">{imp.supplier.name}</p>
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {imp._count.lines} línea(s) · {new Date(imp.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs text-[var(--on-surface-variant)]">
                  {STATUS_LABEL[imp.status] ?? imp.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <SupplierComparisonTable />
    </div>
  );
}
