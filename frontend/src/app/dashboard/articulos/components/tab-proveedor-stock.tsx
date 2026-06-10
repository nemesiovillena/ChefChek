'use client';

import { CategoryTreeNode } from '@/hooks/use-categories';

interface SupplierOption {
  id: string;
  name: string;
}

interface TabProveedorStockProps {
  suppliers: SupplierOption[];
  tree: CategoryTreeNode[];
  formData: {
    supplierId: string;
    familyId: string;
    subfamilyId: string;
    minimumStock: string;
    maximumStock: string;
  };
  setFormData: (data: any) => void;
  currentStock?: number;
}

export default function TabProveedorStock({ suppliers, tree, formData, setFormData, currentStock }: TabProveedorStockProps) {
  const update = (field: string, value: string) => setFormData({ ...formData, [field]: value });

  const subfamilies = tree.find((c) => c.id === formData.familyId)?.children || [];

  const minStock = parseFloat(formData.minimumStock) || 0;
  const maxStock = parseFloat(formData.maximumStock) || 0;
  const isAtMin = currentStock !== undefined && currentStock <= minStock && minStock > 0;
  const isAboveMax = currentStock !== undefined && maxStock > 0 && currentStock >= maxStock;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
        <select value={formData.supplierId} onChange={(e) => update('supplierId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
          <option value="">Seleccionar proveedor</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Familia (Categoría)</label>
          <select value={formData.familyId} onChange={(e) => { update('familyId', e.target.value); update('subfamilyId', ''); }} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Seleccionar familia</option>
            {tree.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subfamilia</label>
          <select value={formData.subfamilyId} onChange={(e) => update('subfamilyId', e.target.value)} disabled={!formData.familyId} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400">
            <option value="">Seleccionar subfamilia</option>
            {subfamilies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
          <input type="number" step="0.01" min="0" value={formData.minimumStock} onChange={(e) => update('minimumStock', e.target.value)} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isAtMin ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} />
          {isAtMin && <p className="text-xs text-red-600 mt-1">Stock en mínimo</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock máximo</label>
          <input type="number" step="0.01" min="0" value={formData.maximumStock} onChange={(e) => update('maximumStock', e.target.value)} className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${isAboveMax ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} />
          {isAboveMax && <p className="text-xs text-red-600 mt-1">Stock por encima del máximo</p>}
        </div>
      </div>
    </div>
  );
}
