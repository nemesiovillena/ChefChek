'use client';

import { CategoryTreeNode } from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { X, SlidersHorizontal } from 'lucide-react';
import CategoryCombobox from './category-combobox';
import SupplierCombobox from './supplier-combobox';

interface FilterPanelProps {
  tree: CategoryTreeNode[];
  suppliers: { id: string; name: string }[];
  selectedCategory: string;
  selectedSupplier: string;
  stockFilter: 'all' | 'ok' | 'low' | 'empty';
  onCategoryChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onStockFilterChange: (value: 'all' | 'ok' | 'low' | 'empty') => void;
  onClear: () => void;
}

export default function FilterPanel({
  tree,
  suppliers,
  selectedCategory,
  selectedSupplier,
  stockFilter,
  onCategoryChange,
  onSupplierChange,
  onStockFilterChange,
  onClear,
}: FilterPanelProps) {
  const activeCount = [selectedCategory, selectedSupplier, stockFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros avanzados
          {activeCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-gray-500 h-7">
            <X className="h-3 w-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Categoría</label>
          <CategoryCombobox
            tree={tree}
            value={selectedCategory}
            onValueChange={onCategoryChange}
            placeholder="Todas las categorías"
          />
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Proveedor</label>
          <SupplierCombobox
            suppliers={suppliers}
            value={selectedSupplier}
            onValueChange={onSupplierChange}
            placeholder="Todos los proveedores"
          />
        </div>

        {/* Stock status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado del stock</label>
          <div className="flex gap-1.5">
            {[
              { value: 'all' as const, label: 'Todos', color: 'bg-gray-100 text-gray-600' },
              { value: 'ok' as const, label: '🟢 OK', color: 'bg-emerald-50 text-emerald-700' },
              { value: 'low' as const, label: '🟡 Bajo', color: 'bg-amber-50 text-amber-700' },
              { value: 'empty' as const, label: '🔴 Agotado', color: 'bg-red-50 text-red-700' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStockFilterChange(opt.value)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  stockFilter === opt.value
                    ? opt.color + ' ring-1 ring-inset ring-current/20'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
