'use client';

import { useState } from 'react';
import { addAlbaranLine } from '@/lib/api-albaran';
import { formatEuro } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnitSelector } from '@/components/shared/unit-selector';
import { useProductNameCheck } from '@/hooks/use-product-name-check';
import { useProductSearch } from '@/hooks/use-product-search';
import { Loader2, Plus, Package, Search, X } from 'lucide-react';

interface AddLineFormProps {
  albaranId: string;
  /** Estado del albarán. En CONFIRMADO el artículo es obligatorio: la línea
   *  nace confirmada y se asienta (stock/precios/total) al crearla. */
  albaranStatus?: 'PENDIENTE' | 'REVISADO' | 'CONFIRMADO';
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Formulario para añadir una línea manual a un albarán.
 * En PENDIENTE/REVISADO la línea es texto libre y se revisa después; en
 * CONFIRMADO exige elegir el artículo porque se asienta al momento (caso
 * típico: una tasa o cargo que el OCR no leyó por venir cortado en la foto).
 */
export function AddLineForm({ albaranId, albaranStatus, onSuccess, onCancel }: AddLineFormProps) {
  const isConfirmed = albaranStatus === 'CONFIRMADO';
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('und');
  const [unitPrice, setUnitPrice] = useState('');
  const [vatPercent, setVatPercent] = useState('10');
  const [lot, setLot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmado: artículo obligatorio. Buscador con el mismo hook que el
  // picker de líneas; el elegido queda fijado en un chip reemplazable.
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const { products, loading: searching, search, setSearch } = useProductSearch();

  // Aviso advisory de duplicados por nombre (mismo criterio que Artículos).
  // La línea sigue siendo texto libre: solo informa para que el usuario sepa
  // que el producto ya existe y pueda cancelar y usarlo en su lugar.
  const { matches: duplicateNameMatches } = useProductNameCheck(description);

  const handleSelectProduct = (product: { id: string; name: string }) => {
    setSelectedProduct(product);
    setSearch('');
    if (!description.trim()) setDescription(product.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    if (isConfirmed && !selectedProduct) return;
    setLoading(true);
    setError(null);

    try {
      await addAlbaranLine(albaranId, {
        description: description.trim(),
        quantity: parseFloat(quantity) || 0,
        unit,
        unitPrice: parseFloat(unitPrice) || 0,
        vatPercent: parseFloat(vatPercent) || 10,
        lot: lot.trim() || undefined,
        ...(selectedProduct ? { matchedProductId: selectedProduct.id } : {}),
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al añadir línea';
      setError(message);
      setLoading(false);
    }
  };

  const lineTotal = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-dashed border-indigo-300">
      <p className="text-xs font-medium text-indigo-600">Añadir línea manual</p>

      {isConfirmed && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          El albarán ya está confirmado: la línea nacerá confirmada y se asentará al momento
          (stock si el artículo lo controla, precio del artículo y total del albarán).
        </div>
      )}

      {isConfirmed && (
        <div>
          <Label className="text-xs">Artículo *</Label>
          {selectedProduct ? (
            <div className="mt-1 flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-sm">
              <Package className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="flex-1 truncate font-medium text-indigo-900">{selectedProduct.name}</span>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
                title="Elegir otro artículo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar el artículo del cargo (p. ej. TASA CLPPV)"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              {search.trim() && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-white shadow-sm">
                  {searching ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : products.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">
                      Sin resultados para «{search}». Si no existe, dalo de alta primero en Artículos
                      (una tasa va sin control de stock).
                    </p>
                  ) : (
                    products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                      >
                        <Package className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="flex-1 truncate">{p.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="line-desc" className="text-xs">Descripción *</Label>
          <Input
            id="line-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Nombre del producto"
            className="h-8 text-sm"
          />
          {duplicateNameMatches.length > 0 && (
            <div role="status" className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>
                <span className="font-medium">Posible duplicado.</span> Ya existe:{' '}
                {duplicateNameMatches.slice(0, 3).map((m, idx) => (
                  <span key={m.id}>
                    <span className="font-semibold">«{m.name}»</span>
                    {!m.isActive && <span className="italic"> (inactivo)</span>}
                    {idx < Math.min(duplicateNameMatches.length, 3) - 1 ? ', ' : ''}
                  </span>
                ))}
                {duplicateNameMatches.length > 3 ? ` y ${duplicateNameMatches.length - 3} más.` : '.'}
              </span>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="line-qty" className="text-xs">Cantidad</Label>
          <Input
            id="line-qty"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Unidad</Label>
          <UnitSelector
            value={unit}
            onChange={setUnit}
            className="h-8 text-sm"
            placeholder="Unidad"
          />
        </div>
        <div>
          <Label htmlFor="line-price" className="text-xs">Precio unidad (€)</Label>
          <Input
            id="line-price"
            type="number"
            step="any"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        {isConfirmed && (
          <div>
            <Label htmlFor="line-vat" className="text-xs">IVA (%)</Label>
            <Input
              id="line-vat"
              type="number"
              step="any"
              min="0"
              value={vatPercent}
              onChange={(e) => setVatPercent(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
        )}
        <div>
          <Label className="text-xs">Total línea</Label>
          <div className="h-8 px-3 flex items-center text-sm font-medium bg-gray-100 rounded-md border">
            {formatEuro(lineTotal)}
          </div>
        </div>
        <div>
          <Label htmlFor="line-lot" className="text-xs">Lote</Label>
          <Input
            id="line-lot"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            placeholder="Nº de lote (opcional)"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !description.trim() || (isConfirmed && !selectedProduct)}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          <span className="ml-1">{isConfirmed ? 'Añadir y asentar línea' : 'Añadir línea'}</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
