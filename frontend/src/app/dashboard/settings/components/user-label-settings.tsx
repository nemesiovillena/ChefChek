'use client';

import { Tag } from 'lucide-react';
import { useModules } from '@/features/modules/hooks/use-modules';
import { ZebraPrinterStatus } from './zebra-printer-status';

/**
 * Configuración para el rol Usuario: solo la impresora de etiquetas (comprobar
 * que Zebra Browser Print la reconoce, elegirla y sacar una prueba). Medidas
 * de rollo y formato no aparecen: guardarlas está reservado a ADMIN.
 */
export function UserLabelSettings() {
  const { isEnabled } = useModules();

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-strong mb-6">Configuración</h1>
        <div id="etiquetas" className="bg-surface-raised shadow rounded-lg mb-6 p-6">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Etiquetas</h2>
          </div>
          {isEnabled('etiquetado') ? (
            <ZebraPrinterStatus />
          ) : (
            <p className="mt-2 text-sm text-text-muted">No hay nada que configurar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
