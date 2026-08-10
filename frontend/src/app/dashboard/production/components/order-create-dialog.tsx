'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { useRecipeOptions } from '@/hooks/use-recipes';
import SubRecipeCombobox from '@/app/dashboard/recipes/components/sub-recipe-combobox';
import type { CreateProductionOrderInput } from '@/hooks/use-production';

interface OrderCreateDialogProps {
  batchId: string;
  onClose: () => void;
  onSubmit: (input: CreateProductionOrderInput) => Promise<void>;
  isSubmitting: boolean;
}

export default function OrderCreateDialog({ batchId, onClose, onSubmit, isSubmitting }: OrderCreateDialogProps) {
  const { data: recipeOptions } = useRecipeOptions();
  const [title, setTitle] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('porciones');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [description, setDescription] = useState('');

  const handleSelectRecipe = (item: { id: string; name: string }) => {
    setRecipeId(item.id);
    setRecipeName(item.name);
  };

  const handleClearRecipe = () => {
    setRecipeId('');
    setRecipeName('');
  };

  const canSubmit = title.trim() !== '' && estimatedTime.trim() !== '' && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      batchId,
      title,
      recipeId: recipeId || undefined,
      recipeName: recipeName || undefined,
      quantity: quantity ? Number(quantity) : undefined,
      unit: unit || undefined,
      estimatedTime: Number(estimatedTime),
      description: description || undefined,
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
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Limpiar la freidora, Marinar el pollo..."
            />
          </div>

          <div>
            <Label>Receta (opcional)</Label>
            <div className="flex items-center gap-2">
              <SubRecipeCombobox
                items={recipeOptions ?? []}
                value={recipeId}
                label={recipeName}
                onSelect={handleSelectRecipe}
                placeholder="Vincular una receta..."
              />
              {recipeId !== '' && (
                <Button type="button" variant="ghost" size="icon" onClick={handleClearRecipe} aria-label="Quitar receta">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cantidad (opcional)</Label>
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

          <div>
            <Label>Descripción (opcional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Explica la tarea..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? 'Creando...' : 'Crear orden'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
