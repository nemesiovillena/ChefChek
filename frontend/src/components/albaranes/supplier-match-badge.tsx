'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Indica si el proveedor se reconoció automáticamente al escanear el albarán
 * (CIF exacto o nombre similar a uno guardado) o si no hubo match. Solo tiene
 * sentido para albaranes creados desde OCR (hasOcrData=false lo oculta).
 */
interface SupplierMatchBadgeProps {
  hasSupplier: boolean;
  hasOcrData: boolean;
  ocrSupplierName?: string | null;
}

export function SupplierMatchBadge({ hasSupplier, hasOcrData, ocrSupplierName }: SupplierMatchBadgeProps) {
  if (!hasOcrData) return null;

  if (hasSupplier) {
    return (
      <span
        className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-emerald-700"
        title="El sistema reconoció el proveedor automáticamente al escanear el albarán"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Reconocido automáticamente
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-700"
      title={
        ocrSupplierName
          ? `El OCR leyó "${ocrSupplierName}" pero no coincide con ningún proveedor guardado.`
          : 'El OCR no pudo leer el nombre del proveedor en el documento.'
      }
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {ocrSupplierName ? `No reconocido — el papel dice "${ocrSupplierName}"` : 'No reconocido'}
    </span>
  );
}
