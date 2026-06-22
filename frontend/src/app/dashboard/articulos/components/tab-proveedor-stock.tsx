'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CategoryTreeNode } from '@/hooks/use-categories';
import SupplierCombobox from './supplier-combobox';
import CategoryCombobox from './category-combobox';
import SupplierQuickCreateDialog from './supplier-quick-create-dialog';

interface SupplierOption {
  id: string;
  name: string;
}

interface TabProveedorStockProps {
  suppliers: SupplierOption[];
  tree: CategoryTreeNode[];
  formData: {
    supplierId: string;
    categoryId: string;
    minimumStock: string;
    maximumStock: string;
  };
  setFormData: (data: any) => void;
  currentStock?: number;
  onSupplierCreated?: (supplier: SupplierOption) => void;
}

export default function TabProveedorStock({ suppliers, tree, formData, setFormData, currentStock, onSupplierCreated }: TabProveedorStockProps) {
  const update = (field: string, value: string) => setFormData({ ...formData, [field]: value });
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);

  const minStock = parseFloat(formData.minimumStock) || 0;
  const maxStock = parseFloat(formData.maximumStock) || 0;
  const isAtMin = currentStock !== undefined && currentStock <= minStock && minStock > 0;
  const isAboveMax = currentStock !== undefined && maxStock > 0 && currentStock >= maxStock;

  return (
    <div className="space-y-4">
      {/* Supplier combobox + create button */}
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
      </div>

      {/* Single category combobox */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <CategoryCombobox
          tree={tree}
          value={formData.categoryId}
          onValueChange={(v) => update('categoryId', v)}
          placeholder="Seleccionar categoría"
        />
      </div>

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

      {/* Quick create supplier dialog */}
      <SupplierQuickCreateDialog
        isOpen={showCreateSupplier}
        onClose={() => setShowCreateSupplier(false)}
        onCreated={(supplier) => {
          onSupplierCreated?.(supplier);
          update('supplierId', supplier.id);
          setShowCreateSupplier(false);
        }}
      />
    </div>
  );
}
