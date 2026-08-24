'use client';

import { useState } from 'react';
import { Award, Layers, Loader2 } from 'lucide-react';
import { formatEuro } from '@/lib/utils';
import type { CatalogImportListItem } from '@/hooks/use-catalog-imports';
import { useCatalogComparison } from '@/hooks/use-catalog-comparison';

/**
 * Compara líneas en crudo entre 2+ catálogos ya extraídos (sin necesidad de
 * aceptar/aplicar ninguna línea): agrupa por parecido de nombre y marca el
 * precio más barato de cada grupo. Complementa a la comparativa contra
 * Artículos (para eso hace falta que el artículo ya exista en tu BD).
 */
export function CatalogComparisonView({ imports }: { imports: CatalogImportListItem[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: groups, isLoading, error } = useCatalogComparison(selectedIds);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <Layers className="h-4 w-4" />
        Comparar catálogos entre sí
      </h2>

      <div className="flex flex-wrap gap-2">
        {imports.map((imp) => (
          <button
            key={imp.id}
            onClick={() => toggle(imp.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              selectedIds.includes(imp.id)
                ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
                : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            {imp.supplier.name} ({imp._count.lines})
          </button>
        ))}
        {imports.length === 0 && (
          <p className="text-xs text-[var(--on-surface-variant)]">
            Sube al menos 2 catálogos para poder compararlos.
          </p>
        )}
      </div>

      {selectedIds.length === 1 && (
        <p className="text-xs text-[var(--on-surface-variant)]">
          Elige al menos un catálogo más para comparar.
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Comparando...
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
          No se pudo comparar: {error.message}
        </div>
      )}

      {groups && groups.length > 0 && (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li
              key={group.representativeName + group.entries[0]?.lineId}
              className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3"
            >
              <p className="mb-2 truncate text-sm font-medium text-[var(--on-surface)]">
                {group.representativeName}
              </p>
              <ul className="space-y-1">
                {group.entries.map((entry) => (
                  <li
                    key={entry.lineId}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs ${
                      entry.isBestPrice ? 'bg-[var(--surface-container-high)]' : ''
                    }`}
                  >
                    <span className="text-[var(--on-surface-variant)]">
                      {entry.supplierName}
                      {entry.purchaseFormat && ` · ${entry.purchaseFormat}`}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-medium ${
                        entry.isBestPrice ? 'text-[var(--primary)]' : 'text-[var(--on-surface)]'
                      }`}
                    >
                      {entry.isBestPrice && <Award className="h-3 w-3" />}
                      {formatEuro(entry.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {groups && groups.length === 0 && selectedIds.length >= 2 && (
        <p className="py-4 text-center text-sm text-[var(--on-surface-variant)]">
          Ninguno de los catálogos elegidos tiene líneas para comparar.
        </p>
      )}
    </div>
  );
}
