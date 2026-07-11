'use client';

import { useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import {
  useProductSupplierOffers,
  useCreateSupplierOffer,
  useDeleteSupplierOffer,
  useSetPreferredSupplierOffer,
} from '@/hooks/use-products';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { formatEuro } from '@/lib/utils';
import SupplierCombobox from './supplier-combobox';
import SupplierQuickCreateDialog from '@/components/shared/supplier-quick-create-dialog';

interface SupplierOption {
  id: string;
  name: string;
}

/** Form fields managed by TabProveedorStock. */
export interface ProveedorStockFormData {
  supplierId: string;
  minimumStock: string;
  maximumStock: string;
}

interface TabProveedorStockProps {
  /** Presente solo en edición: habilita la gestión de varias ofertas de proveedor. */
  productId?: string;
  suppliers: SupplierOption[];
  formData: ProveedorStockFormData;
  setFormData: (data: ProveedorStockFormData) => void;
  currentStock?: number;
  onSupplierCreated?: (supplier: SupplierOption) => void;
  /** Precio Compra ya introducido en "Formato y Precio", para sugerirlo como precio de la primera oferta. */
  basePurchasePrice?: string;
}

export default function TabProveedorStock({
  productId,
  suppliers,
  formData,
  setFormData,
  currentStock,
  onSupplierCreated,
  basePurchasePrice,
}: TabProveedorStockProps) {
  const update = (field: string, value: string) => setFormData({ ...formData, [field]: value });
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);

  const minStock = parseFloat(formData.minimumStock) || 0;
  const maxStock = parseFloat(formData.maximumStock) || 0;
  const isAtMin = currentStock !== undefined && currentStock <= minStock && minStock > 0;
  const isAboveMax = currentStock !== undefined && maxStock > 0 && currentStock >= maxStock;

  return (
    <div className="space-y-4">
      {productId ? (
        <SupplierOffersSection
          productId={productId}
          suppliers={suppliers}
          onSupplierCreated={onSupplierCreated}
          basePurchasePrice={basePurchasePrice}
        />
      ) : (
        // Alta de artículo: todavía no existe un producto al que asociar
        // varias ofertas, así que se asigna un único proveedor inicial. Tras
        // crear el artículo, esta pestaña pasa a mostrar la lista de ofertas.
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SupplierCombobox
                suppliers={suppliers}
                value={formData.supplierId}
                onValueChange={(v) => update('supplierId', v)}
                placeholder="Seleccionar proveedor..."
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateSupplier(true)}
              className="shrink-0 h-[38px] w-[38px] inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
              title="Añadir nuevo proveedor"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Podrás añadir más proveedores para este artículo después de crearlo.
          </p>
        </div>
      )}

      {/* Stock limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.minimumStock}
            onChange={(e) => update('minimumStock', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isAtMin ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {isAtMin && <p className="text-xs text-red-600 mt-1">Stock en mínimo</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock máximo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.maximumStock}
            onChange={(e) => update('maximumStock', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isAboveMax ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {isAboveMax && <p className="text-xs text-red-600 mt-1">Stock por encima del máximo</p>}
        </div>
      </div>

      {/* Quick create supplier dialog (alta inicial, sin productId aún) */}
      {!productId && (
        <SupplierQuickCreateDialog
          isOpen={showCreateSupplier}
          onClose={() => setShowCreateSupplier(false)}
          onCreated={(supplier) => {
            onSupplierCreated?.(supplier);
            update('supplierId', supplier.id);
            setShowCreateSupplier(false);
          }}
        />
      )}
    </div>
  );
}

interface SupplierOffersSectionProps {
  productId: string;
  suppliers: SupplierOption[];
  onSupplierCreated?: (supplier: SupplierOption) => void;
  basePurchasePrice?: string;
}

/** Lista de ofertas de proveedor de un artículo existente: precio por proveedor + preferente. */
function SupplierOffersSection({ productId, suppliers, onSupplierCreated, basePurchasePrice }: SupplierOffersSectionProps) {
  const { data: offers, isLoading } = useProductSupplierOffers(productId);
  const createOffer = useCreateSupplierOffer();
  const deleteOffer = useDeleteSupplierOffer();
  const setPreferred = useSetPreferredSupplierOffer();
  const confirm = useConfirm();
  const addNotification = useNotification();

  // null = sin decisión manual todavía: se auto-abre si la lista está vacía,
  // pero en cuanto el usuario toca Añadir/Cancelar, su elección manda siempre.
  const [showAdd, setShowAdd] = useState<boolean | null>(null);
  const addVisible = showAdd ?? (!isLoading && (offers?.length ?? 0) === 0);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const existingSupplierIds = new Set((offers ?? []).map((o) => o.supplierId));
  const availableSuppliers = suppliers.filter((s) => !existingSupplierIds.has(s.id));

  // Primera oferta del artículo: sugiere el Precio Compra ya introducido en
  // "Formato y Precio" en vez de pedirlo de nuevo en blanco. Para proveedores
  // adicionales (ya hay al menos una oferta) no se sugiere nada — puede variar.
  const isFirstOffer = !isLoading && (offers?.length ?? 0) === 0;
  const suggestedPrice = isFirstOffer ? (basePurchasePrice ?? '') : '';
  const effectivePrice = newPrice || suggestedPrice;

  const handleAdd = async () => {
    const price = parseFloat(effectivePrice);
    if (!newSupplierId || isNaN(price) || price < 0) {
      addNotification({ type: 'error', title: 'Error', message: 'Selecciona un proveedor e indica un precio válido' });
      return;
    }
    try {
      await createOffer.mutateAsync({ productId, supplierId: newSupplierId, purchasePrice: price });
      setNewSupplierId('');
      setNewPrice('');
      setShowAdd(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al añadir la oferta';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const handleDelete = async (offerId: string) => {
    const ok = await confirm({
      title: 'Eliminar oferta de proveedor',
      description: 'Esta acción no se puede deshacer.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteOffer.mutateAsync({ productId, offerId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar la oferta';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const handleSetPreferred = async (offerId: string) => {
    try {
      await setPreferred.mutateAsync({ productId, offerId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al marcar como preferente';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Proveedores</label>
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Cargando ofertas...</p>}
        {!isLoading && (offers?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-500">Este artículo no tiene proveedores asignados todavía.</p>
        )}
        {offers?.map((offer) => (
          <div
            key={offer.id}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2"
          >
            <button
              type="button"
              onClick={() => handleSetPreferred(offer.id)}
              disabled={offer.isPreferred || setPreferred.isPending}
              title={offer.isPreferred ? 'Proveedor preferente' : 'Marcar como preferente'}
              className={`shrink-0 ${offer.isPreferred ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
            >
              <Star className="h-4 w-4" fill={offer.isPreferred ? 'currentColor' : 'none'} />
            </button>
            <span className="flex-1 truncate text-sm text-gray-900">{offer.supplier?.name ?? 'Proveedor'}</span>
            <span className="text-sm text-gray-600">{formatEuro(offer.purchasePrice)}</span>
            <button
              type="button"
              onClick={() => handleDelete(offer.id)}
              disabled={deleteOffer.isPending}
              className="shrink-0 text-gray-400 hover:text-red-600"
              title="Eliminar oferta"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {addVisible ? (
          <div className="flex items-end gap-2 rounded-md border border-dashed border-gray-300 p-2">
            <div className="flex-1">
              <SupplierCombobox
                suppliers={availableSuppliers}
                value={newSupplierId}
                onValueChange={setNewSupplierId}
                placeholder="Proveedor..."
              />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={effectivePrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Precio €"
              className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={createOffer.isPending}
              className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Añadir
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="h-4 w-4" /> Añadir proveedor
            </button>
            <button
              type="button"
              onClick={() => setShowCreateSupplier(true)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Crear proveedor nuevo
            </button>
          </div>
        )}
      </div>

      <SupplierQuickCreateDialog
        isOpen={showCreateSupplier}
        onClose={() => setShowCreateSupplier(false)}
        onCreated={(supplier) => {
          onSupplierCreated?.(supplier);
          setNewSupplierId(supplier.id);
          setShowCreateSupplier(false);
          setShowAdd(true);
        }}
      />
    </div>
  );
}
