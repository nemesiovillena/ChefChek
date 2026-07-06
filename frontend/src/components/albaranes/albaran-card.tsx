'use client';

import Link from 'next/link';
import { AlbaranStatusBadge } from './albaran-status-badge';
import { deleteAlbaran, type Albaran } from '@/lib/api-albaran';
import { FileText, Building2, Calendar, Euro, Layers, Trash2 } from 'lucide-react';

interface AlbaranCardProps {
  albaran: Albaran;
  onDelete?: (id: string) => void;
}

export function AlbaranCard({ albaran, onDelete }: AlbaranCardProps) {
  // El backend rechaza borrar albaranes confirmados/archivados (stock ya asentado)
  const canDelete = albaran.status === 'PENDIENTE' || albaran.status === 'REVISADO';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation from Link
    e.stopPropagation();
    if (!confirm(`¿Estás seguro de eliminar el albarán ${albaran.albaranNumber || albaran.internalNumber || ''}?`)) return;
    try {
      await deleteAlbaran(albaran.id);
      onDelete?.(albaran.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar albarán');
    }
  };

  return (
    <Link href={`/dashboard/albaranes/${albaran.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 cursor-pointer group relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {albaran.albaranNumber || 'Sin número'}
              </h3>
              {albaran.internalNumber && (
                <p className="text-xs text-gray-500">Ref: {albaran.internalNumber}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlbaranStatusBadge status={albaran.status} />
            {canDelete && (
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                title="Eliminar albarán"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span>{albaran.supplier?.name || 'Proveedor desconocido'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>{formatDate(albaran.date)}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{formatCurrency(albaran.total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-400" />
              <span>{albaran._count?.lines || 0} líneas</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
