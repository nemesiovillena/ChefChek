'use client';

import { useState } from 'react';
import { Award, Loader2, MapPin, Search } from 'lucide-react';
import { formatEuro } from '@/lib/utils';
import { useLocations } from '@/hooks/use-locations';
import { useNotification } from '@/components/notification-system';
import {
  useOfferComparison,
  useSetOfferLocationOverride,
} from '@/hooks/use-supplier-comparison';
import { ProductSearchInput, type PickedProduct } from './product-search-input';

export function SupplierComparisonTable() {
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [locationId, setLocationId] = useState('');
  const { data: locations } = useLocations();
  const {
    data: rows,
    isLoading,
    error,
  } = useOfferComparison(product?.id ?? null, locationId || undefined);
  const overrideMut = useSetOfferLocationOverride();
  const addNotification = useNotification();

  const handleToggle = async (offerId: string, enabled: boolean) => {
    if (!locationId) return;
    try {
      await overrideMut.mutateAsync({ offerId, locationId, enabled });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo cambiar la oferta activa',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <Award className="h-4 w-4" />
        Comparativa de proveedores
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <ProductSearchInput
            onSelect={setProduct}
            placeholder="Buscar artículo para comparar precios..."
          />
        </div>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          <option value="">Sin local (oferta preferente)</option>
          {(locations ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {product && (
        <p className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)]">
          <Search className="h-3 w-3" /> {product.name}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando ofertas...
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
          No se pudo cargar la comparativa: {error.message}
        </div>
      )}

      {!isLoading && product && (rows ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">
          Este artículo no tiene ofertas de proveedor registradas.
        </p>
      )}

      {(rows ?? []).length > 0 && (
        <ul className="space-y-2">
          {(rows ?? []).map((row) => (
            <li
              key={row.offerId}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                row.isBestPrice
                  ? 'border-[var(--primary)] bg-[var(--surface-container-lowest)]'
                  : 'border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]'
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-[var(--on-surface)]">
                  {row.supplierName}
                  {row.isBestPrice && (
                    <span className="flex items-center gap-1 rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs text-primary-foreground">
                      <Award className="h-3 w-3" /> Mejor precio
                    </span>
                  )}
                  {row.isPreferred && (
                    <span className="rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs text-[var(--on-surface-variant)]">
                      Preferente
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {formatEuro(row.purchasePrice)}
                  {row.purchaseFormat ? ` · ${row.purchaseFormat}` : ''}
                  {row.referenceUnit ? ` · ${formatEuro(row.referencePrice)}/${row.referenceUnit}` : ''}
                  {row.agreedPrice != null ? ` · pactado ${formatEuro(row.agreedPrice)}` : ''}
                </p>
              </div>

              {locationId && (
                <button
                  onClick={() => handleToggle(row.offerId, !row.isActiveForLocation)}
                  disabled={overrideMut.isPending}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    row.isActiveForLocation
                      ? 'bg-[var(--primary)] text-primary-foreground'
                      : 'border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  {row.isActiveForLocation ? 'Activa en este local' : 'Activar en este local'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
