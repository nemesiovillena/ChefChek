'use client';

import { Product } from '@/hooks/use-products';
import Image from 'next/image';
import { CategoryTreeNode } from '@/hooks/use-categories';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import StockBadge from './stock-badge';
import CategoryPill from './category-pill';

interface ArticuloCardsProps {
  products: Product[];
  tree: CategoryTreeNode[];
  categoryNameMap: Record<string, string>;
  loading?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
}

export default function ArticuloCards({
  products,
  tree,
  categoryNameMap,
  loading,
  onEdit,
  onDelete,
}: ArticuloCardsProps) {
  const getCategoryColor = (categoryId: string | undefined) => {
    if (!categoryId) return null;
    const parent = tree.find((p) => p.children?.some((c) => c.id === categoryId));
    const isParent = tree.some((p) => p.id === categoryId);
    if (isParent) return tree.find((p) => p.id === categoryId)?.color || null;
    return parent?.color || null;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
            <div className="h-5 bg-gray-100 rounded-full w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <p className="text-gray-500 text-sm">No hay artículos que coincidan con los filtros</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {products.map((product) => {
        const catName = categoryNameMap[product.categoryId || ''] || '-';
        const catColor = getCategoryColor(product.categoryId);
        const parent = tree.find((p) => p.children?.some((c) => c.id === product.categoryId));
        const isParent = parent?.id === product.categoryId;

        return (
          <div
            key={product.id}
            className={cn(
              'border rounded-lg p-4 hover:shadow-sm transition-shadow group relative',
              !product.isActive && 'opacity-50',
            )}
          >
            {/* Actions overlay */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(product)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => onDelete(product.id, product.name)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Image */}
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded object-cover mb-2"
              />
            )}

            {/* Name + brand */}
            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
            {product.brand && (
              <p className="text-[11px] text-gray-400 truncate">{product.brand}</p>
            )}

            {/* Category pill */}
            <div className="mt-2">
              <CategoryPill
                name={catName}
                color={catColor}
                parentName={!isParent && parent ? parent.name : undefined}
              />
            </div>

            {/* Price + Stock */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-mono text-gray-700">
                €{(product.purchasePrice || 0).toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-indigo-600 font-mono ml-1">
                {product.referenceUnit && `€${(product.purchasePrice / (product.unitSize || 1)).toFixed(2)}/${product.referenceUnit}`}
              </span>
              <StockBadge
                current={product.stocks?.[0]?.quantity ?? 0}
                minimum={product.stocks?.[0]?.minimumStock}
                unit={product.referenceUnit}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
