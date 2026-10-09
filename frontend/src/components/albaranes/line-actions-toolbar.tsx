'use client';

import { confirmLine } from '@/lib/api-albaran';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface LineActionsToolbarProps {
  albaranId: string;
  lines: AlbaranLine[];
  onRefresh: () => void;
}

export function LineActionsToolbar({ albaranId, lines, onRefresh }: LineActionsToolbarProps) {
  const addNotification = useNotification();
  const confirm = useConfirm();

  const pending = lines.filter((l) => l.lineStatus === 'PENDIENTE');
  // Solo las líneas con producto ya asignado son confirmables (el backend
  // rechaza confirmar una línea sin matchedProductId).
  const confirmable = pending.filter((l) => l.matchedProductId);
  const unresolved = pending.length - confirmable.length;
  const confirmedCount = lines.filter((l) => l.lineStatus === 'CONFIRMADO').length;
  const rejectedCount = lines.filter((l) => l.lineStatus === 'RECHAZADO').length;

  const handleConfirmAll = async () => {
    await confirm({
      title: `Confirmar ${confirmable.length} línea${confirmable.length === 1 ? '' : 's'}`,
      description:
        'Se marcarán como confirmadas todas las líneas con producto asignado, sin tener que hacerlo una a una.',
      confirmText: 'Confirmar todas',
      variant: 'info',
      children:
        unresolved > 0 ? (
          <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-sm text-[var(--on-surface-variant)]">
            Quedarán <strong>{unresolved}</strong> línea{unresolved === 1 ? '' : 's'} pendiente
            {unresolved === 1 ? '' : 's'} sin producto asignado. Elígelas o créalas antes de
            confirmar el albarán.
          </div>
        ) : undefined,
      onConfirm: async () => {
        try {
          await Promise.all(confirmable.map((line) => confirmLine(albaranId, line.id)));
          onRefresh();
        } catch (err) {
          console.error('Error confirming lines:', err);
          addNotification({
            type: 'error',
            title: 'No se pudieron confirmar',
            message: err instanceof Error ? err.message : 'Error al confirmar líneas',
          });
          throw err;
        }
      },
    });
  };

  return (
    // En móvil los contadores ya están en la cabecera del albarán y, junto al
    // botón, desbordaban la pantalla: aquí queda solo el botón a ancho completo.
    // bg-muted (no bg-gray-50): el shim dark de globals.css solo sobrescribe la
    // clase sin prefijo, y "sm:bg-gray-50" se escapaba dejando un fondo claro
    // con texto claro en modo oscuro.
    <div className="flex items-center justify-between gap-4 rounded-lg sm:bg-muted sm:p-4">
      <div className="hidden items-center gap-4 text-sm sm:flex">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>{pending.length} pendientes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>{confirmedCount} confirmadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>{rejectedCount} rechazadas</span>
        </div>
      </div>

      {confirmable.length > 0 && (
        <Button
          onClick={handleConfirmAll}
          variant="default"
          size="sm"
          className="max-sm:h-11 max-sm:w-full"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirmar {confirmable.length} línea{confirmable.length === 1 ? '' : 's'}
        </Button>
      )}
    </div>
  );
}
