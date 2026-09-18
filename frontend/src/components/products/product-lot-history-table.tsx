'use client';

import { useProductLots } from '@/hooks/use-product-lots';
import { Loader2, FileText, AlertTriangle } from 'lucide-react';

interface ProductLotHistoryTableProps {
  productId: string;
}

/**
 * Historial de lotes recibidos de un artículo. Incluye tanto registros
 * formales (`Lot`) como líneas de albarán con nº de lote sin registro
 * (`source: raw_line`) — gap de captura histórico, marcado con aviso.
 */
export function ProductLotHistoryTable({ productId }: ProductLotHistoryTableProps) {
  const { data: lots, isLoading, error } = useProductLots(productId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">Error al cargar lotes</p>;
  }

  if (!lots || lots.length === 0) {
    return <p className="text-sm text-gray-500 py-4">Sin lotes registrados para este artículo</p>;
  }

  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Lote</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Recepción</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Proveedor</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Cantidad</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Albarán</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((entry, i) => (
            <tr key={`${entry.lotNumber}-${entry.albaranInternalNumber ?? i}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-900">
                <div className="flex items-center gap-1.5">
                  {entry.lotNumber}
                  {entry.source === 'raw_line' && (
                    <span title="Sin registro formal de lote — solo el nº capturado en el albarán">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 px-3 text-gray-700">{formatDate(entry.albaranDate)}</td>
              <td className="py-2 px-3 text-gray-700">{entry.supplierName || '—'}</td>
              <td className="py-2 px-3 text-right text-gray-700">
                {entry.quantity}{entry.unit ? ` ${entry.unit}` : ''}
              </td>
              <td className="py-2 px-3">
                {entry.albaranNumber || entry.albaranInternalNumber ? (
                  <span className="inline-flex items-center gap-1 text-indigo-600 text-xs">
                    <FileText className="h-3 w-3" />
                    {entry.albaranNumber || entry.albaranInternalNumber}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
