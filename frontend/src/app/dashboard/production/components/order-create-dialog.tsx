'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useRecipeOptions, type RecipeCost } from '@/hooks/use-recipes';
import type { Product } from '@/hooks/use-products';
import SubRecipeCombobox from '@/app/dashboard/recipes/components/sub-recipe-combobox';
import type { CreateProductionOrderInput, ProductionIngredientInput } from '@/hooks/use-production';

interface OrderCreateDialogProps {
  batchId: string;
  onClose: () => void;
  onSubmit: (input: CreateProductionOrderInput) => Promise<void>;
  isSubmitting: boolean;
}

interface ConvertUnitsResponse {
  converted: { quantity: number; unit: string };
}

interface IngredientRow extends ProductionIngredientInput {
  /** true si no se pudo verificar el stock (p.ej. la conversión de unidad no
   * está soportada) — se deja pasar sin bloquear, pero se avisa en vez de
   * dar por hecho que hay stock. */
  unverified?: boolean;
}

/** Consulta el stock actual de cada ingrediente para marcar isAvailable — una
 * sola vez al elegir la receta, no una suscripción en vivo. El stock se
 * guarda en la unidad de referencia del artículo, que no siempre coincide
 * con la unidad del ingrediente en la receta (p.ej. receta en "g", stock en
 * "kg") — se convierte antes de comparar. Si la conversión falla (unidades
 * que el conversor no reconoce, artículo sin stock configurado, etc.) no se
 * bloquea la orden — se marca como "no verificado" en vez de "sin stock",
 * que sería un falso negativo. */
async function checkIngredientsAvailability(
  ingredients: ProductionIngredientInput[],
): Promise<IngredientRow[]> {
  return Promise.all(
    ingredients.map(async (ingredient): Promise<IngredientRow> => {
      try {
        const { data: product } = await apiClient.get<Product>(`/v1/products/${ingredient.productId}`);
        const available = product.stocks?.[0]?.quantity ?? 0;

        let neededInStockUnit = ingredient.quantity;
        if (ingredient.unit !== product.referenceUnit) {
          try {
            const { data: conversion } = await apiClient.post<ConvertUnitsResponse>(
              '/v1/escandallos/convert-units',
              null,
              {
                params: {
                  fromUnit: ingredient.unit,
                  toUnit: product.referenceUnit,
                  quantity: ingredient.quantity,
                  productId: ingredient.productId,
                },
              },
            );
            neededInStockUnit = conversion.converted.quantity;
          } catch {
            return { ...ingredient, isAvailable: true, unverified: true };
          }
        }

        return { ...ingredient, isAvailable: available >= neededInStockUnit };
      } catch {
        return { ...ingredient, isAvailable: true, unverified: true };
      }
    }),
  );
}

export default function OrderCreateDialog({ batchId, onClose, onSubmit, isSubmitting }: OrderCreateDialogProps) {
  const { data: recipeOptions } = useRecipeOptions();
  const [recipeId, setRecipeId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('porciones');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);

  const handleSelectRecipe = async (item: { id: string; name: string }) => {
    setRecipeId(item.id);
    setRecipeName(item.name);
    setIsLoadingIngredients(true);
    try {
      const { data: cost } = await apiClient.get<RecipeCost>(`/v1/recipes/${item.id}/calculate`);
      const baseQuantity = Number(quantity) || 1;
      const scaledIngredients: IngredientRow[] = (cost?.ingredients ?? []).map((ing) => ({
        productId: ing.productId,
        productName: ing.productName,
        quantity: ing.quantity * baseQuantity,
        unit: ing.unit,
        isAvailable: true,
      }));
      setIngredients(await checkIngredientsAvailability(scaledIngredients));
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const canSubmit =
    recipeId !== '' &&
    quantity.trim() !== '' &&
    estimatedTime.trim() !== '' &&
    ingredients.length > 0 &&
    !isLoadingIngredients;

  const unavailableIngredients = ingredients.filter((ing) => !ing.isAvailable);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      batchId,
      recipeId,
      recipeName,
      quantity: Number(quantity),
      unit,
      estimatedTime: Number(estimatedTime),
      ingredients: ingredients.map(({ unverified: _unverified, ...ing }) => ing),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-lg shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Nueva orden de producción</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Receta</Label>
            <SubRecipeCombobox
              items={recipeOptions ?? []}
              value={recipeId}
              label={recipeName}
              onSelect={handleSelectRecipe}
              placeholder="Buscar receta..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label>Tiempo estimado (min)</Label>
              <Input
                type="number"
                min="0"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
              />
            </div>
          </div>

          {isLoadingIngredients ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ingredientes de la receta...
            </div>
          ) : ingredients.length > 0 ? (
            <div>
              <Label>Ingredientes</Label>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                {ingredients.map((ing) => (
                  <div key={ing.productId} className="flex items-center justify-between text-sm">
                    <span>
                      {ing.productName} — {ing.quantity.toFixed(2)} {ing.unit}
                    </span>
                    {!ing.isAvailable ? (
                      <span className="text-xs font-medium text-destructive">Sin stock suficiente</span>
                    ) : ing.unverified ? (
                      <span className="text-xs text-muted-foreground">Stock no verificado</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {unavailableIngredients.length > 0 && (
                <p className="mt-2 text-xs text-destructive">
                  {unavailableIngredients.length} ingrediente(s) sin stock suficiente — no se podrá crear la orden.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || unavailableIngredients.length > 0}
            >
              {isSubmitting ? 'Creando...' : 'Crear orden'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
