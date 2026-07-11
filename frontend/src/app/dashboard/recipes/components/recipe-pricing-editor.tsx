'use client';

import { useState } from 'react';
import { Recipe, RecipePricing, useUpdateRecipe } from '@/hooks/use-recipes';
import { useInvalidateQueries } from '@/hooks/use-api';
import { useNotification } from '@/components/notification-system';
import { formatEuro } from '@/lib/utils';

const formatPercent = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

/** PVP con IVA manual; PVP sin IVA se deriva (÷1,10) y se muestra solo lectura. Se remonta (via key) cuando llega pricing fresco del servidor. */
export default function RecipePricingEditor({ recipe, pricing }: { recipe: Recipe; pricing: RecipePricing }) {
  const updateRecipeMutation = useUpdateRecipe();
  const invalidateQueries = useInvalidateQueries();
  const addNotification = useNotification();

  const [sellingPriceWithVatInput, setSellingPriceWithVatInput] = useState(
    pricing.sellingPriceWithVat != null ? String(pricing.sellingPriceWithVat) : '',
  );

  const handleSaveSellingPriceWithVat = async () => {
    const value = sellingPriceWithVatInput.trim() === '' ? undefined : parseFloat(sellingPriceWithVatInput);
    if (value !== undefined && (Number.isNaN(value) || value < 0)) return;
    try {
      await updateRecipeMutation.mutateAsync({ id: recipe.id, sellingPriceWithVat: value });
      invalidateQueries([['recipe-cost', recipe.id]]);
      addNotification({ type: 'success', title: 'PVP guardado', message: 'El precio de venta se ha actualizado.' });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'No se pudo guardar el PVP' });
    }
  };

  const overCost = pricing.costPercentage != null && pricing.costPercentage > pricing.targetCostPercentage;

  return (
    <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-500 dark:text-gray-400">Margen Bruto</div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {pricing.grossMargin != null ? formatEuro(pricing.grossMargin) : '—'}
            {pricing.grossMarginPercentage != null && (
              <span className="text-gray-400 dark:text-gray-500 font-normal"> ({formatPercent(pricing.grossMarginPercentage)})</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Margen Bruto Objetivo</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatPercent(pricing.targetGrossMarginPercentage)}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">% Coste Real</div>
          <div className={`font-semibold ${overCost ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {pricing.costPercentage != null ? formatPercent(pricing.costPercentage) : '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PVP (con IVA)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={sellingPriceWithVatInput}
            onChange={(e) => setSellingPriceWithVatInput(e.target.value)}
            onBlur={handleSaveSellingPriceWithVat}
            placeholder="Sin fijar"
            className="w-36 px-3 py-2.5 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white text-lg font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PVP (sin IVA)</label>
          <div className="w-36 px-3 py-2.5 border border-transparent text-gray-900 dark:text-white text-lg font-semibold">
            {pricing.sellingPrice != null ? formatEuro(pricing.sellingPrice) : '—'}
          </div>
        </div>
      </div>

      <p className="text-sm font-bold text-gray-900 dark:text-white">
        El coste objetivo máximo de esta receta es del {formatPercent(pricing.targetCostPercentage)}.
      </p>
    </div>
  );
}
