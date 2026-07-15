'use client';

import { useState } from 'react';
import { addAlbaranLine } from '@/lib/api-albaran';
import { formatEuro } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnitSelector } from '@/components/shared/unit-selector';
import { useProductNameCheck } from '@/hooks/use-product-name-check';
import { Loader2, Plus } from 'lucide-react';

interface AddLineFormProps {
  albaranId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Formulario para añadir una línea manual a un albarán.
 * Solo disponible cuando el albarán está en PENDIENTE o REVISADO.
 */
export function AddLineForm({ albaranId, onSuccess, onCancel }: AddLineFormProps) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('und');
  const [unitPrice, setUnitPrice] = useState('');
  const [vatPercent] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aviso advisory de duplicados por nombre (mismo criterio que Artículos).
  // La línea sigue siendo texto libre: solo informa para que el usuario sepa
  // que el producto ya existe y pueda cancelar y usarlo en su lugar.
  const { matches: duplicateNameMatches } = useProductNameCheck(description);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await addAlbaranLine(albaranId, {
        description: description.trim(),
        quantity: parseFloat(quantity) || 0,
        unit,
        unitPrice: parseFloat(unitPrice) || 0,
        vatPercent: parseFloat(vatPercent) || 10,
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
            step="0.01"
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
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Total línea</Label>
          <div className="h-8 px-3 flex items-center text-sm font-medium bg-gray-100 rounded-md border">
            {formatEuro(lineTotal)}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !description.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          <span className="ml-1">Añadir línea</span>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
