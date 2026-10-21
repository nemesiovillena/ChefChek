'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbaranes, useAlbaranStatusCounts } from '@/hooks/use-albaranes';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useProducts, Product } from '@/hooks/use-products';
import { AlbaranCard } from '@/components/albaranes/albaran-card';
import ManualAlbaranForm from '@/components/albaranes/manual-albaran-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, ChevronLeft, ChevronRight, FileUp, FileText, Archive, X } from 'lucide-react';

/**
 * Hoy hace dos meses en YYYY-MM-DD: frontera de la ventana que muestra la
 * pestaña Activos. Todo lo anterior vive en Archivados.
 */
function startOfTwoMonthWindow(): string {
  const now = new Date();
  // Date normaliza el desbordamiento (31 dic → 31 oct; 31 abr → 1 may)
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${twoMonthsAgo.getFullYear()}-${pad(twoMonthsAgo.getMonth() + 1)}-${pad(twoMonthsAgo.getDate())}`;
}

/**
 * Botones de estado de la pestaña Activos. "Pendientes" agrupa PENDIENTE y
 * REVISADO (todo lo que falta por confirmar) y no tiene límite de fecha: un
 * albarán sin confirmar sigue siendo trabajo pendiente aunque sea antiguo.
 */
type StatusView = 'todos' | 'pendientes' | 'confirmados';

export default function AlbaranesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaranes, meta, loading, error, refetch, setPage, setFilters } = useAlbaranes();

  const queryClient = useQueryClient();
  // Invalida listado y recuentos (ambos cuelgan de la clave 'albaranes')
  const handleAlbaranDelete = () => {
    void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
  };
  const cutoffDate = startOfTwoMonthWindow();
  const statusCounts = useAlbaranStatusCounts(cutoffDate);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusView, setStatusView] = useState<StatusView>('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const hasActiveFilters = !!(searchTerm || dateFrom || dateTo) || statusView !== 'todos';
  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setStatusView('todos');
  };
  const [showManualModal, setShowManualModal] = useState(false);
  // Los archivados no aparecen en el listado general; viven en su propia pestaña
  const [activeTab, setActiveTab] = useState<'activos' | 'archivados'>('activos');

  // Datos para el formulario de albarán manual
  const { data: suppliersData } = useSuppliers({ isActive: true });
  const suppliers = (Array.isArray(suppliersData) ? suppliersData : []).map(
    (s) => ({ id: s.id, name: s.name }),
  );
  const { data: productsData } = useProducts();
  const products: Product[] = Array.isArray(productsData?.data)
    ? productsData.data
    : Array.isArray(productsData)
      ? productsData
      : [];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const archived = activeTab === 'archivados';
      const pending = !archived && statusView === 'pendientes';
      // Activos queda acotado a la ventana de dos meses: el "Desde" del
      // usuario solo puede estrecharla, nunca adelantarla. Pendientes y
      // Archivados no usan la ventana, y buscar tampoco: quien busca un número
      // o proveedor concreto debe encontrarlo aunque sea antiguo (el aviso de
      // duplicado al subir mira todo el histórico).
      const searching = searchTerm.trim() !== '';
      const windowFrom = dateFrom && dateFrom > cutoffDate ? dateFrom : cutoffDate;
      setFilters({
        search: searchTerm,
        pending: pending || undefined,
        status: !archived && statusView === 'confirmados' ? 'CONFIRMADO' : undefined,
        olderThan: archived ? cutoffDate : undefined,
        dateFrom: archived || pending || searching ? dateFrom || undefined : windowFrom,
        dateTo: dateTo || undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusView, dateFrom, dateTo, activeTab, cutoffDate, setFilters]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6">
        {/* En móvil el título y los dos botones no caben en una fila: se apilan
            y los botones se reparten el ancho */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Albaranes</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => router.push('/dashboard/albaranes/subir')}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Subir Albarán
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setShowManualModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Albarán
            </Button>
          </div>
        </div>
        <p className="text-gray-600">Gestión de albaranes de proveedores</p>
      </div>

      {/* Alta manual de albarán */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo albarán manual</DialogTitle>
          </DialogHeader>
          <ManualAlbaranForm
            suppliers={suppliers}
            products={products}
            onComplete={() => {
              setShowManualModal(false);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Pestañas: activos vs archivados (div role=tablist — un <nav> no fijo quedaría oculto por globals.css) */}
      <div role="tablist" className="flex gap-2 border-b border-gray-200 mb-2">
        {(
          [
            { key: 'activos', label: 'Activos', icon: FileText },
            { key: 'archivados', label: 'Archivados', icon: Archive },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Botones de estado: un clic para ver lo que falta por confirmar */}
      {activeTab === 'activos' && (
        <div className="flex flex-wrap gap-2 mt-3 mb-2">
          {(
            [
              { key: 'todos', label: 'Todos', count: statusCounts?.all },
              { key: 'pendientes', label: 'Pendientes', count: statusCounts?.pending },
              { key: 'confirmados', label: 'Confirmados', count: statusCounts?.confirmed },
            ] as const
          ).map((view) => (
            <button
              key={view.key}
              type="button"
              aria-pressed={statusView === view.key}
              onClick={() => setStatusView(view.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                statusView === view.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {view.label}
              {view.count !== undefined && (
                <span
                  className={`min-w-[1.5rem] rounded-full px-1.5 text-xs font-semibold ${
                    statusView === view.key
                      ? 'bg-primary-foreground/20'
                      : view.key === 'pendientes' && view.count > 0
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted'
                  }`}
                >
                  {view.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Qué se está viendo: evita que los antiguos parezcan "desaparecidos" */}
      <p className="text-xs text-gray-500 mb-6">
        {activeTab === 'archivados'
          ? 'Albaranes con más de dos meses y los archivados manualmente'
          : statusView === 'pendientes'
            ? 'Pendientes y revisados sin confirmar, de cualquier fecha'
            : searchTerm.trim()
              ? 'Buscando en todas las fechas'
              : 'Últimos dos meses — los albaranes más antiguos están en Archivados'}
      </p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nº, proveedor o nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        )}
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
            {activeTab === 'archivados' ? (
              <Archive className="h-8 w-8 text-gray-400" />
            ) : (
              <FileUp className="h-8 w-8 text-gray-400" />
            )}
          </div>
          {activeTab === 'archivados' ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay albaranes archivados</h3>
              <p className="text-gray-600">Los albaranes con más de dos meses y los que archives aparecerán aquí</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay albaranes</h3>
              <p className="text-gray-600 mb-4">Sube tu primer albarán para empezar a gestionarlos</p>
              <Button onClick={() => router.push('/dashboard/albaranes/subir')}>
                <FileUp className="mr-2 h-4 w-4" />
                Subir Albarán
              </Button>
            </>
          )}
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
