import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/** Estados comunes de cada pestaña: cargando, error (con causa) y vacío (con siguiente paso). */
export function PanelLoading({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-2 py-12 justify-center text-sm text-on-surface-variant" role="status">
      <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
      Cargando {what}…
    </div>
  );
}

export function PanelError({ error }: { error: Error }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-on-surface">
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      <div>
        <p className="font-medium">No se han podido cargar los datos.</p>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  );
}

export function PanelEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center">
      <p className="font-medium text-on-surface">{title}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{children}</p>
    </div>
  );
}
