'use client';

import { Recipe, RecipeCost, useRecipeCost } from '@/hooks/use-recipes';
import { formatEuro } from '@/lib/utils';
import RecipePricingEditor from './recipe-pricing-editor';
import { IngredientsTable, SubRecipesTable } from './recipe-cost-tables';

const formatPercent = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

export default function RecipeCostModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { data: costData, isLoading: costLoading } = useRecipeCost(recipe.id);

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-6 border border-gray-200 dark:border-zinc-800 w-full max-w-4xl shadow-xl rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Costo: {recipe.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {costLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Calculando costo...</div>
        ) : costData ? (
          <div className="space-y-6">
            <SummaryCards recipe={recipe} costData={costData} />
            <RecipePricingEditor
              key={`${costData.pricing.sellingPriceWithVat ?? 'none'}-${costData.pricing.targetCostPercentage}-${recipe.id}`}
              recipe={recipe}
              pricing={costData.pricing}
            />
            <IngredientsTable costData={costData} />
            {recipe.subRecipes && recipe.subRecipes.length > 0 && <SubRecipesTable recipe={recipe} />}
          </div>
        ) : null}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ recipe, costData }: { recipe: Recipe; costData: RecipeCost }) {
  const { pricing } = costData;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-4 rounded-lg transition-colors">
        <div className="text-sm text-green-700 dark:text-green-400">Costo Total</div>
        <div className="text-2xl font-bold text-green-900 dark:text-green-200">{formatEuro(costData.totalCost)}</div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg transition-colors">
        <div className="text-sm text-blue-700 dark:text-blue-400">Costo por Ración</div>
        <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{formatEuro(costData.costPerPortion)}</div>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-lg transition-colors">
        <div className="text-sm text-amber-700 dark:text-amber-400">Coste Objetivo Máximo</div>
        <div className="text-2xl font-bold text-amber-900 dark:text-amber-200">{formatPercent(pricing.targetCostPercentage)}</div>
      </div>
      <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 p-4 rounded-lg transition-colors">
        <div className="text-sm text-purple-700 dark:text-purple-400">PVP Teórico (coste×{pricing.theoreticalPriceMultiplier})</div>
        <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">{formatEuro(pricing.theoreticalSellingPrice)}</div>
      </div>
    </div>
  );
}
