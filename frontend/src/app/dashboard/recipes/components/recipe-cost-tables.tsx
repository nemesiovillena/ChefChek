'use client';

import { Recipe, RecipeCost } from '@/hooks/use-recipes';
import { formatEuro } from '@/lib/utils';

const formatPercent = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

export function IngredientsTable({ costData }: { costData: RecipeCost }) {
  return (
    <div>
      <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Ingredientes</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              {['Producto', 'Peso Bruto', 'Precio Compra', 'Rendimiento', 'Merma', 'Peso Neto', 'Precio Real', 'Costo'].map((label, i) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap ${i === 7 ? 'text-right' : 'text-left'}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
            {costData.ingredients.map((ingredient, index) => (
              <tr key={index}>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{ingredient.productName}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{ingredient.grossWeight} {ingredient.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatEuro(ingredient.referencePurchasePrice)}/{ingredient.referenceUnit}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatPercent(ingredient.yieldPercentage, 0)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatPercent(ingredient.wastePercentage, 0)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{ingredient.netWeight.toFixed(2)} {ingredient.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatEuro(ingredient.realPrice)}/{ingredient.referenceUnit}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium whitespace-nowrap">{formatEuro(ingredient.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubRecipesTable({ recipe }: { recipe: Recipe }) {
  return (
    <div>
      <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Sub-recetas</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Receta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unidad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Costo</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
            {recipe.subRecipes!.map((sub, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{sub.subRecipeName}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{sub.quantity}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{sub.unit}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">{formatEuro(sub.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
