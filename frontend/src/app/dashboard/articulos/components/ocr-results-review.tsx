'use client';

import { Pencil, Check, AlertTriangle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OcrDetectedProduct {
  name: string;
  price?: number;
  quantity?: number;
  unit?: string;
  confidence: number;
  matchedProductId?: string;
  matchedProductName?: string;
  category?: string;
  supplier?: string;
  lot?: string;
  include: boolean;
}

interface OcrResultsReviewProps {
  products: OcrDetectedProduct[];
  onProductsChange: (products: OcrDetectedProduct[]) => void;
}

/** Review OCR-detected products before importing — toggle include, edit fields, see match info */
export default function OcrResultsReview({ products, onProductsChange }: OcrResultsReviewProps) {
  const toggleInclude = (index: number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], include: !updated[index].include };
    onProductsChange(updated);
  };

  const updateField = (index: number, field: string, value: string | number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    onProductsChange(updated);
  };

  const includedCount = products.filter((p) => p.include).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Productos detectados
        </h3>
        <span className="text-xs text-gray-500">
          {includedCount} de {products.length} seleccionados
        </span>
      </div>

      <div className="space-y-2">
        {products.map((product, i) => (
          <div
            key={i}
            className={cn(
              'border rounded-lg p-3 transition-colors',
              product.include
                ? 'border-indigo-200 bg-indigo-50/30'
                : 'border-gray-200 bg-gray-50/50 opacity-60',
            )}
          >
            <div className="flex items-start gap-3">
              {/* Include checkbox */}
              <button
                onClick={() => toggleInclude(i)}
                className={cn(
                  'mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  product.include
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 hover:border-indigo-400',
                )}
              >
                {product.include && <Check className="h-3 w-3" />}
              </button>

              <div className="flex-1 min-w-0 space-y-2">
                {/* Name + confidence */}
                <div className="flex items-center gap-2">
                  <input
                    value={product.name}
                    onChange={(e) => updateField(i, 'name', e.target.value)}
                    className={cn(
                      'text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none flex-1 min-w-0',
                      !product.include && 'line-through',
                    )}
                  />
                  <ConfidenceBadge confidence={product.confidence} />
                </div>

                {/* Match info */}
                {product.matchedProductName && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <Link2 className="h-3 w-3" />
                    Coincide con: <span className="font-medium">{product.matchedProductName}</span>
                  </div>
                )}

                {/* Editable fields row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Precio</span>
                    <input
                      type="number"
                      step="0.01"
                      value={product.price || ''}
                      onChange={(e) => updateField(i, 'price', parseFloat(e.target.value) || 0)}
                      className="w-16 text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0.5 py-0"
                      placeholder="0.00"
                    />
                    <span className="text-xs text-gray-500">€</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Cant.</span>
                    <input
                      type="number"
                      value={product.quantity || ''}
                      onChange={(e) => updateField(i, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-10 text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0.5 py-0"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Und.</span>
                    <select
                      value={product.unit || 'ud'}
                      onChange={(e) => updateField(i, 'unit', e.target.value)}
                      className="text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="ud">ud</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Categoría*</span>
                    <input
                      type="text"
                      value={product.category || ''}
                      onChange={(e) => updateField(i, 'category', e.target.value)}
                      className="w-24 text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0.5 py-0"
                      placeholder="Requerido"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Proveedor</span>
                    <input
                      type="text"
                      value={product.supplier || ''}
                      onChange={(e) => updateField(i, 'supplier', e.target.value)}
                      className="w-20 text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0.5 py-0"
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-indigo-600 font-semibold uppercase">Lote</span>
                    <input
                      type="text"
                      value={product.lot || ''}
                      onChange={(e) => updateField(i, 'lot', e.target.value)}
                      className="w-16 text-xs border-b border-gray-300 focus:border-indigo-500 focus:outline-none px-0.5 py-0"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Confidence indicator badge */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const isHigh = pct >= 80;
  const isMedium = pct >= 60 && pct < 80;
  const isLow = pct < 60;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        isHigh && 'bg-emerald-50 text-emerald-700',
        isMedium && 'bg-amber-50 text-amber-700',
        isLow && 'bg-red-50 text-red-700',
      )}
    >
      {isLow && <AlertTriangle className="h-2.5 w-2.5" />}
      {pct}%
    </span>
  );
}
