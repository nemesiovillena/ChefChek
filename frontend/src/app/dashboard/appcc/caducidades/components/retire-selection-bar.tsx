'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  RETIRED_DISPOSITION_LABEL,
  useRetireFoodLabels,
  type RetiredDisposition,
} from '@/hooks/use-food-labels';

const CONFIRM_TEXT: Record<RetiredDisposition, string> = {
  CONSUMED: 'Se registra que el producto se gastó.',
  DISCARDED: 'Se registra que el producto se tiró.',
};

/**
 * Barra fija de acciones sobre las etiquetas seleccionadas en Caducidades:
 * marcarlas como consumidas o desechadas. No borra nada — la retirada queda
 * registrada (quién, cuándo y qué se hizo) para APPCC y SICTED.
 */
export function RetireSelectionBar({
  selectedIds,
  onDone,
}: {
  selectedIds: string[];
  onDone: () => void;
}) {
  const addNotification = useNotification();
  const confirm = useConfirm();
  const retire = useRetireFoodLabels();

  const onRetire = async (disposition: RetiredDisposition) => {
    const n = selectedIds.length;
    const what = RETIRED_DISPOSITION_LABEL[disposition].toLowerCase();
    const ok = await confirm({
      title: n === 1 ? `Marcar 1 etiqueta como ${what}` : `Marcar ${n} etiquetas como ${what}s`,
      description: `${CONFIRM_TEXT[disposition]} Deja de avisar de caducidad y queda en el registro APPCC. Se puede deshacer hoy desde el detalle de la etiqueta.`,
      confirmText: 'Confirmar',
      variant: disposition === 'DISCARDED' ? 'warning' : 'info',
    });
    if (!ok) return;
    try {
      const { retired } = await retire.mutateAsync({ ids: selectedIds, disposition });
      addNotification({
        type: 'success',
        title: retired === 1 ? '1 etiqueta retirada' : `${retired} etiquetas retiradas`,
        message: '',
      });
      onDone();
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo retirar',
        message: e instanceof Error ? e.message : 'Error al guardar',
      });
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-40 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] p-3 shadow-lg md:bottom-6">
      <span className="text-sm font-semibold">
        {selectedIds.length} {selectedIds.length === 1 ? 'seleccionada' : 'seleccionadas'}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onRetire('CONSUMED')} disabled={retire.isPending}>
          {retire.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Consumidas
        </Button>
        <Button variant="outline" onClick={() => onRetire('DISCARDED')} disabled={retire.isPending}>
          <Trash2 className="mr-2 h-4 w-4" />
          Desechadas
        </Button>
      </div>
    </div>
  );
}
