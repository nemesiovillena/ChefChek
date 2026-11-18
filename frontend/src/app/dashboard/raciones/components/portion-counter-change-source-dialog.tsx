'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/components/notification-system';
import { useUpdatePortionCounter, type PortionCounter } from '@/hooks/use-raciones';
import {
  PortionCounterSourcePicker,
  type PortionCounterSourcePick,
} from './portion-counter-source-picker';

interface Props {
  counter: PortionCounter;
  onClose: () => void;
}

/**
 * Cambia a qué receta o artículo se une un contador sin perder nada: mismo
 * historial, platos de Cuiner, mínimo y categoría. Desde ese momento solo
 * suman (y piden raciones) las etiquetas de lo nuevo.
 */
export function PortionCounterChangeSourceDialog({ counter, onClose }: Props) {
  const addNotification = useNotification();
  const update = useUpdatePortionCounter();
  const [picked, setPicked] = useState<PortionCounterSourcePick | null>(null);
  const currentType = counter.recipeId ? 'recipe' : 'product';

  const unchanged =
    picked !== null &&
    picked.id === (picked.type === 'recipe' ? counter.recipeId : counter.productId);

  const submit = async () => {
    if (!picked || unchanged) return;
    try {
      await update.mutateAsync({
        id: counter.id,
        ...(picked.type === 'recipe' ? { recipeId: picked.id } : { productId: picked.id }),
      });
      addNotification({
        type: 'success',
        title: 'Contador cambiado',
        message: `Ahora suman las etiquetas de ${picked.type === 'recipe' ? 'la receta' : 'el artículo'} «${picked.name}».`,
      });
      onClose();
    } catch (err) {
      addNotification({ type: 'error', title: 'No se pudo cambiar', message: (err as Error).message });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar receta o artículo</DialogTitle>
          <DialogDescription>
            Ahora suman las etiquetas de {currentType === 'recipe' ? 'la receta' : 'el artículo'}{' '}
            <strong>«{counter.name}»</strong>. Elige lo que etiquetáis de verdad: etiqueta de
            elaborado → <strong>receta</strong>; de manipulado → <strong>artículo</strong>. Se
            conservan el historial, los platos de Cuiner y el mínimo.
          </DialogDescription>
        </DialogHeader>

        <PortionCounterSourcePicker
          initialType={currentType}
          value={picked}
          onChange={setPicked}
        />
        {unchanged && (
          <p className="text-sm text-[var(--on-surface-variant)]">Ya está unido a esto.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!picked || unchanged || update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
