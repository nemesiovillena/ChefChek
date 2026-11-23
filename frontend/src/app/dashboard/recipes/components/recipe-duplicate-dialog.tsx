'use client';

import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Recipe, useDuplicateRecipe } from '@/hooks/use-recipes';

interface RecipeDuplicateDialogProps {
  recipe: Recipe;
  onClose: () => void;
  onDuplicated: (copy: Recipe) => void;
}

/**
 * Pide el nombre de la copia de una receta. La página lo monta solo mientras
 * está abierto, así que el nombre propuesto se reinicia en cada apertura.
 */
export default function RecipeDuplicateDialog({ recipe, onClose, onDuplicated }: RecipeDuplicateDialogProps) {
  const [name, setName] = useState(`${recipe.name} (copia)`);
  const [error, setError] = useState<string | null>(null);
  const duplicateMutation = useDuplicateRecipe();
  const saving = duplicateMutation.isPending;
  const trimmedName = name.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedName || saving) return;
    setError(null);
    try {
      const copy = await duplicateMutation.mutateAsync({ id: recipe.id, newName: trimmedName });
      onDuplicated(copy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo duplicar la receta');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar receta</DialogTitle>
          <DialogDescription>
            Se crea una copia de «{recipe.name}» y se abre para que cambies lo que necesites. La original no se modifica.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-recipe-name">Nombre de la nueva receta</Label>
            <Input
              id="duplicate-recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              disabled={saving}
              autoFocus
              className="text-base"
            />
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!trimmedName || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Duplicar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
