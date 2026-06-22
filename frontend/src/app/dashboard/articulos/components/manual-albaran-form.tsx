'use client';

import { useState, useMemo } from 'react';
import { useNotification } from '@/components/notification-system';
import { useCreateManualAlbaran, ManualAlbaranLineInput } from '@/hooks/use-manual-albaran';
import { Product } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Package } from 'lucide-react';

interface SupplierOption {
  id: string;
  name: string;
}

interface AlbaranLine {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  category: string;
}

interface ManualAlbaranFormProps {
  suppliers: SupplierOption[];
  products: Product[];
  onComplete: () => void;
}

const UNITS = [
  { value: 'und', label: 'Unidades' },
  { value: 'kg', label: 'Kilos' },
  { value: 'L', label: 'Litros' },
];

let lineCounter = 0;
function newLine(): AlbaranLine {
  return { id: `line-${++lineCounter}`, productId: '', name: '', quantity: 1, unit: 'und', price: 0, category: '' };
}

export default function ManualAlbaranForm({ suppliers, products, onComplete }: ManualAlbaranFormProps) {
  const addNotification = useNotification();
  const createMutation = useCreateManualAlbaran();

  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<AlbaranLine[]>([newLine()]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  // Grand total
  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.price, 0),
    [lines],
  );

  const updateLine = (id: string, updates: Partial<AlbaranLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  // Product search: find match and auto-fill
  const selectProduct = (lineId: string, product: Product) => {
    updateLine(lineId, {
      productId: product.id,
      name: product.name,
      unit: product.referenceUnit === 'kg' ? 'kg' : product.referenceUnit === 'L' ? 'L' : 'und',
      price: product.purchasePrice,
      category: product.category?.name || '',
    });
    setProductSearch((prev) => ({ ...prev, [lineId]: product.name }));
  };

  // Filter products for search
  const getFilteredProducts = (lineId: string) => {
    const search = productSearch[lineId] || '';
    if (!search || search.length < 2) return [];
    const lower = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(lower) || p.purchaseFormat?.toLowerCase().includes(lower),
    ).slice(0, 10);
  };

  const handleSubmit = async () => {
    const validLines = lines.filter((l) => l.name.trim() && l.quantity > 0);
    if (validLines.length === 0) {
      addNotification({ type: 'error', title: 'Error', message: 'Añade al menos una línea con nombre y cantidad' });
      return;
    }

    const payload = {
      supplierId: supplierId || undefined,
      supplierName: suppliers.find((s) => s.id === supplierId)?.name || undefined,
      date,
      reference: reference || undefined,
      lines: validLines.map((l) => ({
        productId: l.productId || null,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        price: l.price,
        category: l.category || undefined,
      })),
    };

    try {
      await createMutation.mutateAsync(payload);
      addNotification({ type: 'success', title: 'Albarán registrado', message: 'Entrada de stock procesada correctamente' });
      onComplete();
    } catch (error: any) {
      addNotification({ type: 'error', title: 'Error', message: error.message || 'Error al registrar albarán' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: Supplier, Date, Reference */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">— Sin proveedor —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Nº albarán (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Lines header */}
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
        <div className="col-span-4">Producto</div>
        <div className="col-span-2">Cantidad</div>
        <div className="col-span-1">Unidad</div>
        <div className="col-span-2">Precio (€)</div>
        <div className="col-span-2">Total</div>
        <div className="col-span-1"></div>
      </div>

      {/* Lines */}
      {lines.map((line) => {
        const filtered = getFilteredProducts(line.id);
        const lineTotal = line.quantity * line.price;

        return (
          <div key={line.id} className="relative">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Product search */}
              <div className="col-span-4 relative">
                <div className="flex items-center gap-1">
                  {line.productId && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓</span>
                  )}
                  <input
                    type="text"
                    value={productSearch[line.id] ?? line.name}
                    onChange={(e) => {
                      setProductSearch((prev) => ({ ...prev, [line.id]: e.target.value }));
                      updateLine(line.id, { name: e.target.value, productId: '' });
                    }}
                    placeholder="Buscar producto o escribir nombre"
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {/* Dropdown results */}
                {filtered.length > 0 && !line.productId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(line.id, p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"
                      >
                        <Package className="h-3 w-3 text-gray-400" />
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-gray-400">{p.purchaseFormat}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity || ''}
                  onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Unit */}
              <div className="col-span-1">
                <select
                  value={line.unit}
                  onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.price || ''}
                  onChange={(e) => updateLine(line.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Line total */}
              <div className="col-span-2 text-right text-sm font-medium text-gray-700">
                €{lineTotal.toFixed(2)}
              </div>

              {/* Delete */}
              <div className="col-span-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Category (shown for new products) */}
            {!line.productId && line.name && (
              <div className="mt-1 ml-0 col-span-4">
                <input
                  type="text"
                  value={line.category}
                  onChange={(e) => updateLine(line.id, { category: e.target.value })}
                  placeholder="Categoría (para producto nuevo)"
                  className="w-full max-w-xs px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add line + Grand total + Submit */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
          <Plus className="h-4 w-4" />
          Añadir línea
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Total: <strong className="text-gray-900">€{grandTotal.toFixed(2)}</strong>
          </span>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? 'Procesando...' : 'Confirmar entrada'}
          </Button>
        </div>
      </div>
    </div>
  );
}
