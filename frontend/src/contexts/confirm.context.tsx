'use client';

import * as React from 'react';
import { ConfirmDialog, type ConfirmVariant } from '@/components/ui/confirm-dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** Contenido extra bajo la descripción (tarjeta de contexto, etc.). */
  children?: React.ReactNode;
  /**
   * Acción opcional a ejecutar al confirmar. Si se aporta, el diálogo gestiona
   * el estado de carga: muestra spinner, cierra al resolver correctamente y
   * permanece abierto (sin cerrar) si lanza, para que el usuario pueda reintentar.
   * La promesa devuelta por useConfirm() resuelve true cuando se confirma.
   */
  onConfirm?: () => void | Promise<void>;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn>(async () => false);
ConfirmContext.displayName = 'ConfirmContext';

interface DialogState {
  open: boolean;
  isPending: boolean;
  options: ConfirmOptions;
}

const INITIAL_STATE: DialogState = { open: false, isPending: false, options: { title: '' } };

/**
 * Proveedor de confirmaciones globales. Expone useConfirm(), que abre un único
 * diálogo M3 y resuelve a true (confirmar) / false (cancelar). Sustituye al
 * confirm() nativo del navegador en toda la app.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState>(INITIAL_STATE);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const settle = React.useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const close = React.useCallback(
    (result: boolean) => {
      setState((prev) => ({ ...prev, open: false, isPending: false }));
      settle(result);
    },
    [settle],
  );

  const confirm = React.useCallback<ConfirmFn>((options) => {
    setState({ open: true, isPending: false, options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = React.useCallback(async () => {
    const action = state.options.onConfirm;
    if (!action) {
      close(true);
      return;
    }
    // onConfirm aportado: gestionar carga y cerrar solo si tiene éxito.
    setState((prev) => ({ ...prev, isPending: true }));
    try {
      await action();
      close(true);
    } catch {
      // Dejar el diálogo abierto para reintento; el llamador ya habrá notificado.
      setState((prev) => ({ ...prev, isPending: false }));
    }
  }, [close, state.options]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && !state.isPending) close(false);
    },
    [close, state.isPending],
  );

  const { options } = state;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        isPending={state.isPending}
      >
        {options.children}
      </ConfirmDialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Devuelve una función confirm(options) => Promise<boolean>.
 * Resuelve true si el usuario confirma, false si cancela o cierra.
 */
export function useConfirm(): ConfirmFn {
  return React.useContext(ConfirmContext);
}
