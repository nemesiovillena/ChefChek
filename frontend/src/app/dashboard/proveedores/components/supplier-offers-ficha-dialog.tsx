'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSupplierOffers, useUpdateSupplierOffer } from '@/hooks/use-products';
import { AgreedPriceCell } from '@/app/dashboard/articulos/components/agreed-price-cell';
import { SupplierDetailPanel } from './supplier-detail-panel';
import { formatEuro } from '@/lib/utils';

interface SupplierOffersFichaDialogProps {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
}

type FichaTab = 'precios' | 'detalle';

/** Ficha de proveedor con pestañas reales: precios pactados por producto + histórico/productos asociados.
 * Sustituye el patrón de fila-expandible-tras-chevron de supplier-table.tsx; también es el destino del
 * link "ir a ficha proveedor" desde tab-proveedor-stock.tsx (Artículos). */
export function SupplierOffersFichaDialog({ supplierId, supplierName, onClose }: SupplierOffersFichaDialogProps) {
  const [activeTab, setActiveTab] = useState<FichaTab>('precios');
  const { user } = useAuth();
  const readOnly = user?.role === 'VIEWER';
  const { data: offers, isLoading } = useSupplierOffers(supplierId);
  const updateOffer = useUpdateSupplierOffer();
  const queryClient = useQueryClient();

  const TABS: { id: FichaTab; label: string }[] = [
    { id: 'precios', label: 'Precios pactados' },
    { id: 'detalle', label: 'Productos e histórico' },
  ];

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-3xl shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{supplierName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="border-b border-gray-200 dark:border-zinc-800 mb-4">
          <div role="tablist" aria-label="Secciones de la ficha de proveedor" className="flex -mb-px space-x-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[200px] max-h-[60vh] overflow-y-auto">
          {activeTab === 'precios' && (
            <div>
              {isLoading && <p className="text-sm text-gray-500">Cargando ofertas...</p>}
              {!isLoading && (offers?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">Este proveedor no tiene productos asociados todavía.</p>
              )}
              <div className="space-y-2">
                {offers?.map((offer) => (
                  <div key={offer.id} className="rounded-md border border-gray-300 dark:border-zinc-700 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                        {offer.product.name}
                        {offer.product.category?.name && (
                          <span className="ml-1 text-xs text-gray-500">· {offer.product.category.name}</span>
                        )}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{formatEuro(offer.purchasePrice)}</span>
                    </div>
                    <AgreedPriceCell
                      agreedPrice={offer.agreedPrice}
                      currentPrice={offer.purchasePrice}
                      isSaving={updateOffer.isPending}
                      readOnly={readOnly}
                      onSave={async (value) => {
                        await updateOffer.mutateAsync({
                          productId: offer.productId,
                          offerId: offer.id,
                          purchasePrice: offer.purchasePrice,
                          agreedPrice: value,
                        });
                        // useUpdateSupplierOffer solo invalida las queries ['products', productId, ...] —
                        // esta vista usa una queryKey distinta (['suppliers', supplierId, 'offers']) que
                        // esa invalidación no cubre. Sin esto, el precio pactado se guarda pero la fila
                        // sigue mostrando el valor antiguo hasta que expire el staleTime.
                        queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'offers'] });
                      }}
                    />
                  </div>
                ))}
              </div>
              {updateOffer.isPending && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...
                </div>
              )}
            </div>
          )}

          {activeTab === 'detalle' && <SupplierDetailPanel supplierId={supplierId} supplierName={supplierName} />}
        </div>
      </div>
    </div>
  );
}
