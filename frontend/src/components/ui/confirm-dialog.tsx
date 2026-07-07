'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Trash2, TriangleAlert, Info, Loader2 } from 'lucide-react';

export type ConfirmVariant = 'destructive' | 'warning' | 'info';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** Muestra un spinner y bloquea los botones (p. ej. mientras corre la mutación). */
  isPending?: boolean;
  /** Contenido extra bajo la descripción (tarjeta de contexto, advertencias, etc.). */
  children?: React.ReactNode;
}

const VARIANT_STYLES: Record<
  ConfirmVariant,
  { icon: React.ReactNode; tile: string; confirm: string }
> = {
  destructive: {
    icon: <Trash2 className="h-7 w-7" strokeWidth={2} />,
    tile: 'bg-[var(--error-container)] text-[var(--on-error-container)]',
    confirm: 'bg-[var(--error)] text-[var(--on-error)]',
  },
  warning: {
    icon: <TriangleAlert className="h-7 w-7" strokeWidth={2} />,
    tile: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    confirm: 'bg-amber-500 text-white dark:bg-amber-600',
  },
  info: {
    icon: <Info className="h-7 w-7" strokeWidth={2} />,
    tile: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    confirm: 'bg-[var(--primary)] text-[var(--on-primary)]',
  },
};

/**
 * Diálogo de confirmación Material 3 Expressive.
 * Fuente única de verdad para todas las confirmaciones de la app: reemplaza
 * al confirm() nativo del navegador. Controlado (open/onOpenChange/onConfirm).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'destructive',
  isPending = false,
  children,
}: ConfirmDialogProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[28px] border border-[var(--outline-variant)] bg-[var(--surface-container-high)] p-6 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          {/* Contenedor de icono M3 */}
          <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${styles.tile}`}>
            {styles.icon}
          </div>

          <DialogPrimitive.Title className="text-center text-xl font-medium tracking-tight text-[var(--on-surface)]">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-2 text-center text-sm leading-relaxed text-[var(--on-surface-variant)]">
              {description}
            </DialogPrimitive.Description>
          )}

          {children && <div className="mt-5">{children}</div>}

          {/* Acciones M3: cancelar (texto) + confirmar (filled) */}
          <div className="mt-7 flex items-center justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                disabled={isPending}
                className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--on-surface)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:pointer-events-none disabled:opacity-50"
              >
                {cancelText}
              </button>
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-[filter,opacity] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40 disabled:pointer-events-none disabled:opacity-60 ${styles.confirm}`}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? `${confirmText}…` : confirmText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
