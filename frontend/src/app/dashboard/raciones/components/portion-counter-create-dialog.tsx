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
import { useCreatePortionCounter } from '@/hooks/use-raciones';
import {
  PortionCounterSourcePicker,
  type PortionCounterSourcePick,
} from './portion-counter-source-picker';

interface Props {
  onClose: () => void;
  /** Recibe el id del contador creado (para abrir su detalle y enlazar platos). */
  onCreated: (id: string) => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

/**
 * Alta de un contador: qué etiquetas suman (las de una receta elaborada o las
 * de un artículo manipulado) y el mínimo con el que avisar.
 */
export function PortionCounterCreateDialog({ onClose, onCreated }: Props) {
  const addNotification = useNotification();
  const create = useCreatePortionCounter();
  const [picked, setPicked] = useState<PortionCounterSourcePick | null>(null);
  const [minPortions, setMinPortions] = useState('3');

  const min = Number(minPortions.replace(',', '.'));
  const valid = picked && Number.isFinite(min) && min >= 0;

  const submit = async () => {
    if (!valid || !picked) return;
    try {
      const res = await create.mutateAsync({
        ...(picked.type === 'recipe' ? { recipeId: picked.id } : { productId: picked.id }),
        minPortions: min,
      });
      const created = (res as { data: { id: string } }).data;
      addNotification({
        type: 'success',
        title: 'Contador creado',
        message: `${picked.name}: ahora enlaza sus platos de Cuiner.`,
      });
      onCreated(created.id);
    } catch (err) {
      addNotification({ type: 'error', title: 'No se pudo crear', message: (err as Error).message });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo contador</DialogTitle>
          <DialogDescription>
            Sumarán las etiquetas de lo que elijas. Pescados y carnes que se racionan
            suelen ser <strong>artículos</strong>; los platos elaborados, <strong>recetas</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PortionCounterSourcePicker value={picked} onChange={setPicked} />

          <label className="block text-sm">
            <span className="text-[var(--on-surface-variant)]">Avisar cuando queden</span>
            <input
              inputMode="decimal"
              value={minPortions}
              onChange={(e) => setMinPortions(e.target.value)}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
              Raciones o menos. 0 = solo avisar al agotarse.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
