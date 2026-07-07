'use client';

import { useState } from 'react';
import { Recipe, RecipePricing, useUpdateRecipe } from '@/hooks/use-recipes';
import { useInvalidateQueries } from '@/hooks/use-api';
import { useNotification } from '@/components/notification-system';
import { formatEuro } from '@/lib/utils';

const formatPercent = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

/** PVP sin IVA + coste objetivo propio de la receta; se remonta (via key) cuando llega pricing fresco del servidor. */
export default function RecipePricingEditor({ recipe, pricing }: { recipe: Recipe; pricing: RecipePricing }) {
  const updateRecipeMutation = useUpdateRecipe();
  const invalidateQueries = useInvalidateQueries();
  const addNotification = useNotification();

  const [sellingPriceInput, setSellingPriceInput] = useState(
    pricing.sellingPrice != null ? String(pricing.sellingPrice) : '',
  );
  const [overrideInput, setOverrideInput] = useState(
    pricing.isTargetCostOverridden ? String(pricing.targetCostPercentage) : '',
  );

  const handleSaveSellingPrice = async () => {
    const value = sellingPriceInput.trim() === '' ? undefined : parseFloat(sellingPriceInput);
    if (value !== undefined && (Number.isNaN(value) || value < 0)) return;
    try {
      await updateRecipeMutation.mutateAsync({ id: recipe.id, sellingPrice: value });
      invalidateQueries([['recipe-cost', recipe.id]]);
      addNotification({ type: 'success', title: 'PVP guardado', message: 'El precio de venta se ha actualizado.' });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'No se pudo guardar el PVP' });
    }
  };

  const handleSaveOverride = async (clear = false) => {
    const value = clear || overrideInput.trim() === '' ? null : parseFloat(overrideInput);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) return;
    try {
      await updateRecipeMutation.mutateAsync({ id: recipe.id, targetCostPercentageOverride: value });
      invalidateQueries([['recipe-cost', recipe.id]]);
      if (clear) setOverrideInput('');
      addNotification({ type: 'success', title: 'Coste objetivo actualizado', message: clear ? 'Ahora usa el valor global.' : 'Se ha guardado el % propio de esta receta.' });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'No se pudo guardar el coste objetivo' });
    }
  };

  const overCost = pricing.costPercentage != null && pricing.costPercentage > pricing.targetCostPercentage;

  return (
    <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PVP (sin IVA)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={sellingPriceInput}
            onChange={(e) => setSellingPriceInput(e.target.value)}
            onBlur={handleSaveSellingPrice}
            placeholder="Sin fijar"
            className="w-32 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Coste objetivo propio (%)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              onBlur={() => handleSaveOverride(false)}
              placeholder={`Global: ${formatPercent(pricing.targetCostPercentage, 0)}`}
              className="w-28 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {pricing.isTargetCostOverridden && (
              <button
                type="button"
                onClick={() => handleSaveOverride(true)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Usar global
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
    </div>
  );
}
