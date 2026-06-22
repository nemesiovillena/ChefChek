'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { matchLine } from '@/lib/api-albaran';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface CreateProductInlineProps {
  albaranId: string;
  line: AlbaranLine;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateProductInline({
  albaranId,
  line,
  onSuccess,
  onCancel,
}: CreateProductInlineProps) {
  const [name, setName] = useState(line.description);
  const [price, setPrice] = useState(String(line.unitPrice));
  const [unit, setUnit] = useState(line.unit || 'kg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create product
      const response = await apiClient.post<{ id: string }>('/v1/products', {
        name,
        netPrice: parseFloat(price),
        referenceUnit: unit,
        purchasePrice: parseFloat(price),
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        purchaseFormat: unit,
      });

      const productId = response.data.id;

      // Match line to new product
      await matchLine(albaranId, line.id, productId);

      onSuccess();
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Error al crear producto';
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
          <Label htmlFor="price" className="text-xs">Precio</Label>
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
        <div>
          <Label htmlFor="unit" className="text-xs">Unidad</Label>
          <Input
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
      </div>

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
