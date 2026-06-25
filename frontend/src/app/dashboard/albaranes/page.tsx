'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useAlbaranes } from '@/hooks/use-albaranes';
import { AlbaranCard } from '@/components/albaranes/albaran-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, ChevronLeft, ChevronRight, FileUp } from 'lucide-react';
import type { AlbaranStatus } from '@/lib/api-albaran';

export default function AlbaranesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaranes, meta, loading, error, refetch, setPage, setFilters } = useAlbaranes();

  const handleAlbaranDelete = (id: string) => {
    refetch();
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlbaranStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: searchTerm, status: statusFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, dateFrom, dateTo, setFilters]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Albaranes</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/ingestion')}>
              <FileUp className="mr-2 h-4 w-4" />
              Subir Albarán
            </Button>
            <Button onClick={() => router.push('/dashboard/ingestion')}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Albarán
            </Button>
          </div>
        </div>
        <p className="text-gray-600">Gestión de albaranes de proveedores</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar albarán..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AlbaranStatus | '')}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los estados</SelectItem>
              <SelectItem value="PENDIENTE">Pendiente</SelectItem>
              <SelectItem value="REVISADO">Revisado</SelectItem>
              <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
              <SelectItem value="ARCHIVADO">Archivado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            placeholder="Desde"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            placeholder="Hasta"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty State */}
      {!loading && albaranes.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileUp className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay albaranes</h3>
          <p className="text-gray-600 mb-4">Sube tu primer albarán para empezar a gestionarlos</p>
          <Button onClick={() => router.push('/dashboard/ingestion')}>
            <FileUp className="mr-2 h-4 w-4" />
            Subir Albarán
          </Button>
        </div>
      )}

      {/* Albaranes Grid */}
      {!loading && albaranes.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {albaranes.map((albaran) => (
              <AlbaranCard key={albaran.id} albaran={albaran} onDelete={handleAlbaranDelete} />
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page === 1}
                onClick={() => setPage(meta.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Página {meta.page} de {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page === meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
