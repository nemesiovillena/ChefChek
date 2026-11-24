'use client';

import { CategoryTreeNode } from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { X, SlidersHorizontal } from 'lucide-react';
import CategoryCombobox from '@/components/shared/category-combobox';
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
    <div className="bg-surface-raised border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-default">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros avanzados
          {activeCount > 0 && (
            <span className="bg-secondary-container/50 text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-text-muted h-7">
            <X className="h-3 w-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Categoría</label>
          <CategoryCombobox
            tree={tree}
            value={selectedCategory}
            onValueChange={onCategoryChange}
            placeholder="Todas las categorías"
          />
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Proveedor</label>
          <SupplierCombobox
            suppliers={suppliers}
            value={selectedSupplier}
            onValueChange={onSupplierChange}
            placeholder="Todos los proveedores"
          />
        </div>

        {/* Stock status */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Estado del stock</label>
          <div className="flex gap-1.5">
            {[
              { value: 'all' as const, label: 'Todos', color: 'bg-surface-subtle text-text-soft', dot: '' },
              { value: 'ok' as const, label: 'OK', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
              { value: 'low' as const, label: 'Bajo', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
              { value: 'empty' as const, label: 'Agotado', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStockFilterChange(opt.value)}
                type="button"
                aria-pressed={stockFilter === opt.value}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  stockFilter === opt.value
                    ? opt.color + ' ring-1 ring-inset ring-current/20'
                    : 'bg-surface-sunken text-text-soft hover:bg-surface-hover'
                }`}
              >
                {opt.dot && <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${opt.dot}`} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
