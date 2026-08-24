'use client';

import { useState } from 'react';
import { FileClock, Loader2, Trash2 } from 'lucide-react';
import { useCatalogImports, useDeleteCatalogImport } from '@/hooks/use-catalog-imports';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { CatalogImportUploader } from './catalog-import-uploader';
import { CatalogImportReview } from './catalog-import-review';
import { SupplierComparisonTable } from './supplier-comparison-table';
import { CatalogComparisonView } from './catalog-comparison-view';

const STATUS_LABEL: Record<string, string> = {
  PROCESANDO: 'Procesando...',
  PENDIENTE: 'Pendiente de revisión',
  APLICADO: 'Aplicado',
  DESCARTADO: 'Descartado',
  ERROR: 'Error',
};

export function CatalogosTab() {
  const { data: imports, isLoading, error } = useCatalogImports();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deleteMut = useDeleteCatalogImport();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const handleDelete = async (id: string, supplierName: string) => {
    const ok = await confirm({
      title: 'Borrar importación',
      description: `Se borrará el registro de la importación de "${supplierName}". Si ya se aplicó, las ofertas de proveedor creadas no se ven afectadas.`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo borrar la importación',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

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
            <li
              key={imp.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition hover:bg-[var(--surface-container-high)]"
            >
              <button
                onClick={() => setSelectedId(imp.id)}
                className="flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="font-medium text-[var(--on-surface)]">{imp.supplier.name}</p>
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {imp._count.lines} línea(s) · {new Date(imp.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                    imp.status === 'ERROR'
                      ? 'bg-[var(--error-container)] text-[var(--on-error-container)]'
                      : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                  }`}
                >
                  {imp.status === 'PROCESANDO' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {STATUS_LABEL[imp.status] ?? imp.status}
                </span>
              </button>
              <button
                onClick={() => handleDelete(imp.id, imp.supplier.name)}
                disabled={deleteMut.isPending}
                aria-label="Borrar importación"
                className="mr-2 rounded-lg p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <CatalogComparisonView imports={imports ?? []} />

      <SupplierComparisonTable />
    </div>
  );
}
