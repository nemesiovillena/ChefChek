'use client';

import { Recipe, RecipeCost } from '@/hooks/use-recipes';
import { formatEuro } from '@/lib/utils';
import { formatUnitSymbol } from '@/lib/unit-symbols';

const formatPercent = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;
// Hasta 3 decimales sin ceros sobrantes: 0,47 kg brutos de 0,4 kg limpios.
const formatWeight = (value: number) => Number(value.toFixed(3));

export function IngredientsTable({ costData }: { costData: RecipeCost }) {
  return (
    <div>
      <h4 className="text-lg font-medium mb-4 text-text-strong">Ingredientes</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line-soft">
          <thead className="bg-surface-sunken">
            <tr>
              {['Producto', 'Peso Bruto', 'Rendimiento', 'Merma', 'Peso Neto', 'Precio Real', 'Costo'].map((label, i, arr) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-xs font-medium text-text-muted uppercase whitespace-nowrap ${i === arr.length - 1 ? 'text-right' : 'text-left'}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface-raised divide-y divide-line-soft">
            {costData.ingredients.map((ingredient, index) => (
              <tr key={index}>
                <td className="px-4 py-3 text-sm text-text-strong whitespace-nowrap">
                  <span className="lowercase">{ingredient.productName}</span>
                  {ingredient.note && (
                    <div className="text-xs font-normal text-gray-400 dark:text-gray-500">{ingredient.note}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{formatWeight(ingredient.grossWeight)} {formatUnitSymbol(ingredient.unit)}</td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{formatPercent(ingredient.yieldPercentage, 0)}</td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{formatPercent(ingredient.wastePercentage, 0)}</td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{formatWeight(ingredient.netWeight)} {formatUnitSymbol(ingredient.unit)}</td>
                <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{formatEuro(ingredient.realPrice)}/{ingredient.referenceUnit}</td>
                <td className="px-4 py-3 text-sm text-text-strong text-right font-medium whitespace-nowrap">{formatEuro(ingredient.cost)}</td>
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
      <h4 className="text-lg font-medium mb-4 text-text-strong">Sub-recetas</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line-soft">
          <thead className="bg-surface-sunken">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Receta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Unidad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase">Costo</th>
            </tr>
          </thead>
          <tbody className="bg-surface-raised divide-y divide-line-soft">
            {recipe.subRecipes!.map((sub, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-text-strong">{sub.subRecipeName}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{sub.quantity}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{formatUnitSymbol(sub.unit)}</td>
                <td className="px-6 py-4 text-sm text-text-strong text-right font-medium">{formatEuro(sub.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
