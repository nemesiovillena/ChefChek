'use client';

import { useState } from 'react';
import { Plus, Star, Trash2, Tags, Check, X, Pencil } from 'lucide-react';
import {
  useProductSupplierOffers,
  useCreateSupplierOffer,
  useDeleteSupplierOffer,
  useSetPreferredSupplierOffer,
  useUpdateSupplierOffer,
  type ProductSupplierOffer,
} from '@/hooks/use-products';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { formatEuro } from '@/lib/utils';
import { UnitSelector } from '@/components/shared/unit-selector';
import SupplierCombobox from './supplier-combobox';
import SupplierQuickCreateDialog from '@/components/shared/supplier-quick-create-dialog';

/** Formato/cantidad por unidad + precio: mismo shape para alta y edición de oferta. */
interface OfferFormatState {
  purchasePrice: string;
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: string;
  referenceUnitSize: string;
}

const emptyOfferFormat = (referenceUnit = ''): OfferFormatState => ({
  purchasePrice: '',
  purchaseFormat: '',
  referenceUnit,
  unitsPerFormat: '1',
  referenceUnitSize: '1',
});

/** Campos de formato/cantidad-por-unidad + precio, compartidos por alta y edición de oferta. */
function OfferFormatFields({
  value,
  onChange,
}: {
  value: OfferFormatState;
  onChange: (data: OfferFormatState) => void;
}) {
  const update = (field: keyof OfferFormatState, v: string) => onChange({ ...value, [field]: v });
  const unitsPerFormat = parseInt(value.unitsPerFormat) || 1;
  const referenceUnitSize = parseFloat(value.referenceUnitSize) || 1;
  const price = parseFloat(value.purchasePrice) || 0;
  const totalUnitSize = unitsPerFormat * referenceUnitSize;
  const refPrice = totalUnitSize > 0 ? price / totalUnitSize : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={value.purchaseFormat}
          onChange={(e) => update('purchaseFormat', e.target.value)}
          placeholder="Formato (ej: Caja 6x2L)"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        <UnitSelector
          value={value.referenceUnit}
          onChange={(symbol) => update('referenceUnit', symbol)}
          placeholder="Unidad ref."
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Uds/formato</label>
          <input
            type="number"
            step="1"
            min="1"
            value={value.unitsPerFormat}
            onChange={(e) => update('unitsPerFormat', e.target.value)}
            placeholder="Ej: 6"
            title="Unidades por formato (ej: 6 botellas por caja)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Cantidad/ud</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={value.referenceUnitSize}
            onChange={(e) => update('referenceUnitSize', e.target.value)}
            placeholder="Ej: 2"
            title="Cantidad por unidad (ej: 2 litros por botella)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Precio €</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={value.purchasePrice}
            onChange={(e) => update('purchasePrice', e.target.value)}
            placeholder="Ej: 12.50"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
      {price > 0 && totalUnitSize > 0 && (
        <p className="text-xs text-indigo-600">
          ≈ {formatEuro(refPrice)}/{value.referenceUnit || 'ud'}
          {totalUnitSize !== 1 ? ` (total ${totalUnitSize} ${value.referenceUnit || 'ud'} por formato)` : ''}
        </p>
      )}
    </div>
  );
}

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
  /** Unidad de referencia del artículo (pestaña "Formato y Precio"), por defecto para nuevas ofertas. */
  baseReferenceUnit?: string;
}

export default function TabProveedorStock({
  productId,
  suppliers,
  formData,
  setFormData,
  currentStock,
  onSupplierCreated,
  basePurchasePrice,
  baseReferenceUnit,
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
          baseReferenceUnit={baseReferenceUnit}
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
  baseReferenceUnit?: string;
}

/** Lista de ofertas de proveedor de un artículo existente: precio por proveedor + preferente. */
function SupplierOffersSection({ productId, suppliers, onSupplierCreated, basePurchasePrice, baseReferenceUnit }: SupplierOffersSectionProps) {
  const { data: offers, isLoading } = useProductSupplierOffers(productId);
  const createOffer = useCreateSupplierOffer();
  const deleteOffer = useDeleteSupplierOffer();
  const setPreferred = useSetPreferredSupplierOffer();
  const updateOffer = useUpdateSupplierOffer();
  const confirm = useConfirm();
  const addNotification = useNotification();

  // null = sin decisión manual todavía: se auto-abre si la lista está vacía,
  // pero en cuanto el usuario toca Añadir/Cancelar, su elección manda siempre.
  const [showAdd, setShowAdd] = useState<boolean | null>(null);
  const addVisible = showAdd ?? (!isLoading && (offers?.length ?? 0) === 0);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newOffer, setNewOffer] = useState<OfferFormatState>(() => emptyOfferFormat(baseReferenceUnit));
  // Edición inline del precio pactado (control de desviaciones, módulo Compras)
  const [editingAgreedId, setEditingAgreedId] = useState<string | null>(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState('');
  // Edición inline de formato/cantidad-por-unidad/precio de una oferta ya creada
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editOffer, setEditOffer] = useState<OfferFormatState>(emptyOfferFormat());

  const existingSupplierIds = new Set((offers ?? []).map((o) => o.supplierId));
  const availableSuppliers = suppliers.filter((s) => !existingSupplierIds.has(s.id));

  // Primera oferta del artículo: sugiere el Precio Compra ya introducido en
  // "Formato y Precio" en vez de pedirlo de nuevo en blanco. Para proveedores
  // adicionales (ya hay al menos una oferta) no se sugiere nada — puede variar.
  const isFirstOffer = !isLoading && (offers?.length ?? 0) === 0;
  const effectivePrice = newOffer.purchasePrice || (isFirstOffer ? (basePurchasePrice ?? '') : '');

  const handleAdd = async () => {
    const price = parseFloat(effectivePrice);
    if (!newSupplierId || isNaN(price) || price < 0) {
      addNotification({ type: 'error', title: 'Error', message: 'Selecciona un proveedor e indica un precio válido' });
      return;
    }
    try {
      await createOffer.mutateAsync({
        productId,
        supplierId: newSupplierId,
        purchasePrice: price,
        purchaseFormat: newOffer.purchaseFormat || undefined,
        referenceUnit: newOffer.referenceUnit || undefined,
        unitsPerFormat: parseInt(newOffer.unitsPerFormat) || undefined,
        referenceUnitSize: parseFloat(newOffer.referenceUnitSize) || undefined,
      });
      setNewSupplierId('');
      setNewOffer(emptyOfferFormat(baseReferenceUnit));
      setShowAdd(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al añadir la oferta';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const startEditOffer = (offer: ProductSupplierOffer) => {
    setEditingOfferId(offer.id);
    setEditOffer({
      purchasePrice: String(offer.purchasePrice),
      purchaseFormat: offer.purchaseFormat || '',
      referenceUnit: offer.referenceUnit || baseReferenceUnit || '',
      unitsPerFormat: String(offer.unitsPerFormat || 1),
      referenceUnitSize: String(offer.referenceUnitSize || 1),
    });
  };

  const handleSaveOfferEdit = async (offer: ProductSupplierOffer) => {
    const price = parseFloat(editOffer.purchasePrice);
    if (isNaN(price) || price < 0) {
      addNotification({ type: 'error', title: 'Error', message: 'Precio inválido' });
      return;
    }
    try {
      await updateOffer.mutateAsync({
        productId,
        offerId: offer.id,
        purchasePrice: price,
        purchaseFormat: editOffer.purchaseFormat || undefined,
        referenceUnit: editOffer.referenceUnit || undefined,
        unitsPerFormat: parseInt(editOffer.unitsPerFormat) || undefined,
        referenceUnitSize: parseFloat(editOffer.referenceUnitSize) || undefined,
      });
      setEditingOfferId(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar la oferta';
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

  const startEditAgreed = (offer: ProductSupplierOffer) => {
    setEditingAgreedId(offer.id);
    setAgreedPriceInput(offer.agreedPrice != null ? String(offer.agreedPrice) : '');
  };

  const handleSaveAgreed = async (offer: ProductSupplierOffer) => {
    const trimmed = agreedPriceInput.trim();
    const agreedPrice = trimmed === '' ? null : parseFloat(trimmed);
    if (agreedPrice !== null && (isNaN(agreedPrice) || agreedPrice < 0)) {
      addNotification({ type: 'error', title: 'Error', message: 'Precio pactado inválido' });
      return;
    }
    try {
      await updateOffer.mutateAsync({
        productId,
        offerId: offer.id,
        purchasePrice: offer.purchasePrice,
        agreedPrice,
      });
      setEditingAgreedId(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar el precio pactado';
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
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <div className="flex items-center gap-2">
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
                onClick={() => (editingOfferId === offer.id ? setEditingOfferId(null) : startEditOffer(offer))}
                className="shrink-0 text-gray-400 hover:text-indigo-600"
                title="Editar formato/precio"
              >
                <Pencil className="h-4 w-4" />
              </button>
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

            {/* Formato/cantidad por unidad: propio de CADA oferta — no lo
                sincroniza "Formato y Precio" (eso es solo del preferente).
                Sin esto no había forma de comparar €/ref.unit entre
                proveedores con distinto formato (ej. caja 6x2L vs botella 2L). */}
            {editingOfferId === offer.id ? (
              <div className="mt-2 pl-6 space-y-2">
                <OfferFormatFields value={editOffer} onChange={setEditOffer} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveOfferEdit(offer)}
                    disabled={updateOffer.isPending}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOfferId(null)}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : offer.unitsPerFormat * offer.referenceUnitSize !== 1 ? (
              <p className="mt-1 pl-6 text-xs text-gray-500">
                {offer.purchaseFormat || `${offer.unitsPerFormat}×${offer.referenceUnitSize}${offer.referenceUnit}`}
                {' — '}≈ {formatEuro(offer.purchasePrice / (offer.unitsPerFormat * offer.referenceUnitSize))}/{offer.referenceUnit}
              </p>
            ) : null}

            {/* Precio pactado (control de desviaciones, módulo Compras) */}
            <div className="mt-1.5 flex items-center gap-2 pl-6">
              <Tags className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {editingAgreedId === offer.id ? (
                <>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    autoFocus
                    value={agreedPriceInput}
                    onChange={(e) => setAgreedPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAgreed(offer);
                      if (e.key === 'Escape') setEditingAgreedId(null);
                    }}
                    placeholder="Sin pactar"
                    className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveAgreed(offer)}
                    disabled={updateOffer.isPending}
                    className="text-green-600 hover:text-green-700"
                    title="Guardar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAgreedId(null)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditAgreed(offer)}
                  className="text-xs text-gray-500 hover:text-indigo-600"
                >
                  {offer.agreedPrice != null
                    ? `Pactado: ${formatEuro(offer.agreedPrice)}`
                    : 'Fijar precio pactado'}
                </button>
              )}
            </div>
          </div>
        ))}

        {addVisible ? (
          <div className="space-y-2 rounded-md border border-dashed border-gray-300 p-2">
            <SupplierCombobox
              suppliers={availableSuppliers}
              value={newSupplierId}
              onValueChange={setNewSupplierId}
              placeholder="Proveedor..."
            />
            <OfferFormatFields
              value={{ ...newOffer, purchasePrice: effectivePrice }}
              onChange={setNewOffer}
            />
            <div className="flex gap-2">
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
