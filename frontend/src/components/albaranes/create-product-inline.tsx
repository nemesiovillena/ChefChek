'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import { matchLine } from '@/lib/api-albaran';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnitSelector } from '@/components/shared/unit-selector';
import { Loader2, Plus } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface CreateProductInlineProps {
  albaranId: string;
  line: AlbaranLine;
  /** Proveedor del albarán: el producto nace vinculado a él */
  supplierId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateProductInline({
  albaranId,
  line,
  supplierId,
  onSuccess,
  onCancel,
}: CreateProductInlineProps) {
  const [name, setName] = useState(line.description);
  const [price, setPrice] = useState(String(line.unitPrice));
  const [unit, setUnit] = useState(line.unit || 'kg');
  // Contenido del formato en unidad de referencia (ej: lata de guisantes de
  // 250 g → 0.25 kg). Determina el precio REF (€/kg-L-ud) que rige escandallos.
  const [contentSize, setContentSize] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedContent = parseFloat(contentSize);
  const parsedPrice = parseFloat(price);
  const refPricePreview =
    parsedContent > 0 && parsedPrice >= 0 ? parsedPrice / parsedContent : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(parsedContent > 0)) {
      setError('El contenido debe ser mayor que 0');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Create product
      const response = await apiClient.post<{ id: string }>('/v1/products', {
        name,
        netPrice: parsedPrice,
        referenceUnit: unit,
        purchasePrice: parsedPrice,
        unitsPerFormat: 1,
        referenceUnitSize: parsedContent,
        purchaseFormat: parsedContent !== 1 ? `${contentSize} ${unit}` : unit,
        // El backend interpreta `supplier` como el ID del proveedor
        ...(supplierId ? { supplier: supplierId } : {}),
      });

      const productId = response.data.id;

      // Match line to new product
      await matchLine(albaranId, line.id, productId);

      onSuccess();
    } catch (err: unknown) {
      let message = 'Error al crear producto';
      if (err instanceof AxiosError) {
        const dataMessage = err.response?.data as { message?: unknown } | undefined;
        if (typeof dataMessage?.message === 'string') {
          message = dataMessage.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-50 rounded-lg">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="name" className="text-xs">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="price" className="text-xs">Precio (por formato)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="content-size" className="text-xs">Contenido</Label>
            <Input
              id="content-size"
              type="number"
              step="0.001"
              min="0.001"
              value={contentSize}
              onChange={(e) => setContentSize(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="unit" className="text-xs">Unidad</Label>
            <UnitSelector
              value={unit}
              onChange={setUnit}
              className="h-8 text-sm"
              placeholder="Unidad"
            />
          </div>
        </div>
      </div>

      {refPricePreview !== null && (
        <p className="text-xs text-gray-500">
          Precio de referencia:{' '}
          <span className="font-medium text-gray-700">
            {refPricePreview.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/{unit}
          </span>
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          <span className="ml-1">Crear y asignar</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
