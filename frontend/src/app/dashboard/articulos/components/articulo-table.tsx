'use client';

import { useState } from 'react';
import { Pencil, QrCode, Trash2, Download, ChevronDown, ArrowUp, ArrowDown, X, Eye } from 'lucide-react';
import { Product, getReferencePrice, formatRefPrice } from '@/hooks/use-products';
import { CategoryTreeNode } from '@/hooks/use-categories';
import { cn } from '@/lib/utils';
import StockBadge from './stock-badge';
import CategoryPill from './category-pill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ArticuloTableProps {
  products: Product[];
  tree: CategoryTreeNode[];
  categoryNameMap: Record<string, string>;
  loading?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (product: Product) => void;
  onGenerateQR: (product: Product) => void;
  onDownloadQR: (productId: string) => void;
  onDeleteQR: (productId: string, qrCodeId: string) => void;
  onViewQR: (productId: string) => void;
  qrCodes: Map<string, any>;
  qrLoading?: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export default function ArticuloTable({
  products,
  tree,
  categoryNameMap,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onGenerateQR,
  onDownloadQR,
  onDeleteQR,
  onViewQR,
  qrCodes,
  qrLoading,
  sortField,
  sortDirection,
  onSort,
}: ArticuloTableProps) {
  const SortIcon = ({ field }: { field: string }) => {
    const active = sortField === field;
    const dir = active ? sortDirection : 'asc';
    return (
      <span className={cn('ml-1 inline-flex flex-col', !active && 'opacity-30')}>
        <span className={cn('text-[8px] leading-none', dir === 'asc' && active && 'text-indigo-600')}>▲</span>
        <span className={cn('text-[8px] leading-none', dir === 'desc' && active && 'text-indigo-600')}>▼</span>
      </span>
    );
  };

  const getParentCategory = (categoryId: string | undefined) => {
    if (!categoryId) return null;
    return tree.find((p) => p.children?.some((c) => c.id === categoryId)) || null;
  };

  const getCategoryColor = (categoryId: string | undefined) => {
    if (!categoryId) return null;
    const parent = getParentCategory(categoryId);
    const isParent = tree.some((p) => p.id === categoryId);
    if (isParent) {
      const cat = tree.find((p) => p.id === categoryId);
      return cat?.color || null;
    }
    return parent?.color || null;
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-lg divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-3 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-4 bg-gray-200 rounded w-48" />
              <div className="h-5 bg-gray-100 rounded-full w-24" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-5 bg-gray-100 rounded-full w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-12 text-center">
        <p className="text-gray-500 text-sm">No hay artículos que coincidan con los filtros</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_130px_120px_60px_100px_130px_80px_80px_90px_90px] gap-3 px-4 py-2.5 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider select-none">
        <button onClick={() => onSort('name')} className="flex items-center hover:text-gray-700 text-left">
          Nombre <SortIcon field="name" />
        </button>
        <button onClick={() => onSort('category')} className="flex items-center hover:text-gray-700 text-left">
          Categoría <SortIcon field="category" />
        </button>
        <span>Proveedor</span>
        <span>Formatos</span>
        <button onClick={() => onSort('purchasePrice')} className="flex items-center justify-end hover:text-gray-700 text-right">
          Precio <SortIcon field="purchasePrice" />
        </button>
        <span className="text-right">Precio Ref.</span>
        <span className="text-right">Stock</span>
        <span className="text-center">Estado</span>
        <span className="text-right">QR</span>
        <span className="text-right">Acciones</span>
      </div>

      {/* Table rows */}
      <div className="divide-y">
        {products.map((product) => {
          const parent = getParentCategory(product.categoryId);
          const catColor = getCategoryColor(product.categoryId);
          const catName = categoryNameMap[product.categoryId || ''] || '-';
          const isParent = parent?.id === product.categoryId;
          const qrCode = qrCodes.get(product.id);

          return (
            <div
              key={product.id}
              className={cn(
                'grid grid-cols-[1fr_130px_120px_60px_100px_130px_80px_80px_90px_90px] gap-3 px-4 py-2.5 items-center',
                'hover:bg-gray-50 transition-colors group',
                !product.isActive && 'opacity-50',
              )}
            >
              {/* Name */}
              <div className="flex items-center gap-2 min-w-0">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-7 w-7 rounded object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  {product.brand && (
                    <p className="text-[11px] text-gray-400 truncate">{product.brand}</p>
                  )}
                </div>
              </div>

              {/* Category pill */}
              <div className="min-w-0">
                <CategoryPill
                  name={catName}
                  color={catColor}
                  parentName={!isParent && parent ? parent.name : undefined}
                />
              </div>

              {/* Supplier */}
              <span className="text-xs text-gray-500 truncate">
                {product.supplier?.name || '-'}
              </span>

              {/* Purchase format */}
              <span className="text-xs text-gray-600 truncate" title={product.purchaseFormat || '-'}>
                {product.purchaseFormat || '-'}
              </span>

              {/* Purchase price with change indicator */}
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm text-gray-700 font-mono">
                  €{(product.purchasePrice || 0).toFixed(2)}
                </span>
                {product.previousPurchasePrice > 0 && product.purchasePrice !== product.previousPurchasePrice && (
                  (() => {
                    const diff = product.purchasePrice - product.previousPurchasePrice;
                    const pct = ((diff / product.previousPurchasePrice) * 100).toFixed(0);
                    const isUp = diff > 0;
                    return (
                      <span
                        className={cn(
                          'inline-flex items-center text-[10px] font-bold px-1 py-0.5 rounded',
                          isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
                        )}
                        title={`Antes: €${product.previousPurchasePrice.toFixed(2)} (${isUp ? '+' : ''}${pct}%)`}
                      >
                        {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                        {pct}%
                      </span>
                    );
                  })()
                )}
              </div>

              {/* Reference price per unit */}
              <div className="flex items-center justify-end pl-2">
                <span className="text-sm font-semibold text-indigo-600 font-mono">
                  {formatRefPrice(getReferencePrice(product), product.referenceUnit)}
                </span>
              </div>

              {/* Stock badge */}
              <div className="flex justify-end">
                <StockBadge
                  current={product.stocks?.[0]?.quantity ?? 0}
                  minimum={product.stocks?.[0]?.minimumStock}
                  maximum={product.stocks?.[0]?.maximumStock}
                  unit={product.referenceUnit}
                />
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <button
                  onClick={() => onToggleStatus(product)}
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer transition-all',
                    product.isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  )}
                >
                  {product.isActive ? 'Activo' : 'Off'}
                </button>
              </div>

              {/* QR actions */}
              <div className="flex items-center justify-end gap-1.5">
                {qrCode ? (
                  <>
                    <button
                      onClick={() => onViewQR(product.id)}
                      title="Ver código QR"
                      className="w-8 h-8 inline-flex items-center justify-center border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDownloadQR(product.id)}
                      title="Descargar QR"
                      className="w-8 h-8 inline-flex items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteQR(product.id, qrCode.qrCodeId)}
                      title="Eliminar QR"
                      className="w-8 h-8 inline-flex items-center justify-center border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onGenerateQR(product)}
                    title="Generar QR"
                    className="w-8 h-8 inline-flex items-center justify-center border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Edit/Delete actions */}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => onEdit(product)}
                  title="Editar artículo"
                  className="w-8 h-8 inline-flex items-center justify-center border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(product.id, product.name)}
                  title="Eliminar artículo"
                  className="w-8 h-8 inline-flex items-center justify-center border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}