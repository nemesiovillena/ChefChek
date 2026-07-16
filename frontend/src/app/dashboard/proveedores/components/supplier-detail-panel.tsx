'use client';

import { Loader2, Package } from 'lucide-react';
import { useSupplierProducts } from '@/hooks/use-suppliers';
import { SupplierPriceHistory } from '@/app/dashboard/articulos/components/supplier-price-history-chart';

interface Props {
  supplierId: string;
  supplierName: string;
}

/** Expandable detail shown under a supplier row: price history + linked products. */
export function SupplierDetailPanel({ supplierId, supplierName }: Props) {
  const { data: productsResponse, isLoading } = useSupplierProducts(supplierId);
  const products = productsResponse?.data ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
          Histórico de precios
        </h4>
        <SupplierPriceHistory supplierId={supplierId} supplierName={supplierName} />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
          Productos asociados{productsResponse ? ` (${productsResponse.total})` : ''}
        </h4>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">Sin productos asociados.</p>
        ) : (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                <Package className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" />
                <span className="truncate">{p.name}</span>
                {p.category?.name && (
                  <span className="shrink-0 text-xs text-[var(--on-surface-variant)]">· {p.category.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
