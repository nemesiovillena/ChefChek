'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { UnitSelector } from '@/components/shared/unit-selector';
import { formatEuro } from '@/lib/utils';
import { normalizeUnitSymbol } from '@/lib/unit-symbols';
import { Category, CategoryTreeNode, mergeAddedCategories } from '@/hooks/use-categories';
import CategoryCombobox from '@/components/shared/category-combobox';
import CategoryQuickCreateDialog from '@/components/shared/category-quick-create-dialog';

/** Form fields managed by PesoPrecioFields. */
export interface PesoPrecioFormData {
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: string;
  referenceUnitSize: string;
  purchasePrice: string;
  discountPercentage: string;
  iva: string;
  brand: string;
  categoryId: string;
}

interface PesoPrecioFieldsProps {
  formData: PesoPrecioFormData;
  setFormData: (data: PesoPrecioFormData) => void;
  tree: CategoryTreeNode[];
}

// Dynamic labels based on reference unit
const UNIT_LABELS: Record<string, { size: string; sizePlaceholder: string; total: string }> = {
  kg: { size: 'Kilos por unidad', sizePlaceholder: 'Ej: 25', total: 'kg' },
  L:  { size: 'Litros por unidad', sizePlaceholder: 'Ej: 1.5', total: 'L' },
  und: { size: '', sizePlaceholder: '', total: 'und' },
};


export default function PesoPrecioFields({ formData, setFormData, tree }: PesoPrecioFieldsProps) {
  const update = (field: string, value: string) => {
    const updates: Record<string, string> = { [field]: value };

    // When referenceUnit changes to "und", hide referenceUnitSize and force to 1
    if (field === 'referenceUnit' && value === 'und') {
      updates.referenceUnitSize = '1';
    }
    setFormData({ ...formData, ...updates });
  };

  const [showCreateCategory, setShowCreateCategory] = useState(false);
  // Categorías creadas en línea: se fusionan al árbol para mostrarlas al instante.
  const [addedCategories, setAddedCategories] = useState<Category[]>([]);
  const effectiveTree = useMemo(() => mergeAddedCategories(tree, addedCategories), [tree, addedCategories]);

  // Live reference price preview
  const price = parseFloat(formData.purchasePrice) || 0;
  const unitsPerFormat = parseInt(formData.unitsPerFormat) || 1;
  const referenceUnitSize = parseFloat(formData.referenceUnitSize) || 1;
  const calculatedUnitSize = unitsPerFormat * referenceUnitSize;
  const refPrice = calculatedUnitSize > 0 ? price / calculatedUnitSize : 0;

  const unitLabelKey = normalizeUnitSymbol(formData.referenceUnit);
  const unitLabels = (unitLabelKey && UNIT_LABELS[unitLabelKey]) || {
    size: 'Cantidad por unidad',
    sizePlaceholder: 'Ej: 1',
    total: formData.referenceUnit || 'unidad',
  };
  const isUnd = unitLabelKey === 'und';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formato de compra</label>
          <input
            type="text"
            value={formData.purchaseFormat}
            onChange={(e) => update('purchaseFormat', e.target.value)}
            placeholder="Ej: Caja 6 botellas, Saco 25kg"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de referencia</label>
          <UnitSelector
            value={formData.referenceUnit}
            onChange={(symbol) => update('referenceUnit', symbol)}
            className="w-full"
            placeholder="Seleccionar unidad"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidades por formato</label>
          <input
            type="number"
            step="1"
            min="1"
            value={formData.unitsPerFormat}
            onChange={(e) => update('unitsPerFormat', e.target.value)}
            placeholder="Ej: 6 (botellas por caja)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* referenceUnitSize field — hidden when referenceUnit is "und" */}
        {!isUnd && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{unitLabels.size}</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={formData.referenceUnitSize}
              onChange={(e) => update('referenceUnitSize', e.target.value)}
              placeholder={unitLabels.sizePlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio Compra (&euro;)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={formData.purchasePrice}
            onChange={(e) => update('purchasePrice', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% Descuento <span className="text-gray-400">(opcional)</span></label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.discountPercentage}
            onChange={(e) => update('discountPercentage', e.target.value)}
            placeholder="Ej: 10"
            title="Descuento informativo del proveedor sobre este artículo. No recalcula el Precio Compra."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% IVA</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.iva}
            onChange={(e) => update('iva', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Reference price preview */}
      {price > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-indigo-700">
            Precio de referencia: <strong>{formatEuro(refPrice)}/{formData.referenceUnit || 'kilo'}</strong>
          </span>
          {unitsPerFormat > 1 && (
            <span className="text-xs text-indigo-500">
              Total: {calculatedUnitSize} {unitLabels.total} por formato
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <CategoryCombobox
                tree={effectiveTree}
                value={formData.categoryId}
                onValueChange={(v) => update('categoryId', v)}
                placeholder="Seleccionar categoría"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateCategory(true)}
              className="shrink-0 h-[38px] w-[38px] inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
              title="Añadir nueva categoría"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca <span className="text-gray-400">(opcional)</span></label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="Marca del artículo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Quick create category dialog — crea y autoselecciona al instante */}
      <CategoryQuickCreateDialog
        isOpen={showCreateCategory}
        onClose={() => setShowCreateCategory(false)}
        tree={tree}
        onCreated={(category) => {
          setAddedCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]));
          update('categoryId', category.id);
          setShowCreateCategory(false);
        }}
      />
    </div>
  );
}
