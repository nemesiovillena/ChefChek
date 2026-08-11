'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useProductionBatches } from '@/hooks/use-production';
import type { CreateWorkBatchInput, WorkBatch } from '@/hooks/use-production';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus, RefreshCw, Loader2, FileBarChart } from 'lucide-react';
import BatchCreateDialog from './components/batch-create-dialog';
import BatchList from './components/batch-list';
import BatchDetailPanel from './components/batch-detail-panel';
import StaffList from './components/staff-list';
import ProductionReportDialog from './components/production-report-dialog';

export const dynamic = 'force-dynamic';

type ProductionTab = 'batches' | 'history' | 'staff';

const HISTORY_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export default function ProductionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { batches, isLoading, error, refetch, createBatch, isCreating } = useProductionBatches();
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  // undefined = el usuario aún no ha tocado la selección manualmente, así que
  // el lote de la URL (llegada desde "Tareas de Prep." del dashboard) manda.
  const [manualBatchId, setManualBatchId] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ProductionTab>('batches');

  const batchIdParam = searchParams.get('batchId');
  const highlightOrderId = searchParams.get('orderId');
  const paramBatchId = batchIdParam && batches.some((b) => b.id === batchIdParam) ? batchIdParam : null;
  const selectedBatchId = manualBatchId !== undefined ? manualBatchId : paramBatchId;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Los lotes completados/cancelados salen del listado de trabajo activo y
  // quedan disponibles en la pestaña "Historial" sin perderse.
  const activeBatches = useMemo(
    () => batches.filter((b) => !HISTORY_STATUSES.has(b.status)),
    [batches],
  );
  const historyBatches = useMemo(
    () => batches.filter((b) => HISTORY_STATUSES.has(b.status)),
    [batches],
  );

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const handleCreateBatch = async (input: CreateWorkBatchInput) => {
    await createBatch(input);
    setIsCreateBatchModalOpen(false);
  };

  const handleSelectBatch = (batch: WorkBatch) => {
    setManualBatchId(selectedBatchId === batch.id ? null : batch.id);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Producción</h1>
        <p className="text-muted-foreground mt-1">
          Lotes de producción y órdenes de trabajo de cocina
        </p>
      </div>

      <div role="tablist" className="mb-6 flex gap-2 overflow-x-auto border-b">
        <button
          role="tab"
          aria-selected={activeTab === 'batches'}
          onClick={() => setActiveTab('batches')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'batches' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Lotes y órdenes
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Historial
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'staff'}
          onClick={() => setActiveTab('staff')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'staff' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Personal
        </button>
      </div>

      {activeTab === 'staff' ? (
        <StaffList />
      ) : activeTab === 'history' ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">Historial de lotes</h2>
            <Button variant="outline" onClick={() => refetch()} className="self-start sm:self-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                No se pudieron cargar los lotes de producción. Por favor intenta nuevamente.
              </AlertDescription>
            </Alert>
          ) : (
            <BatchList
              batches={historyBatches}
              selectedBatchId={selectedBatchId}
              onSelect={handleSelectBatch}
              emptyTitle="Sin lotes en el historial"
              emptyDescription="Los lotes completados o cancelados aparecerán aquí"
            />
          )}

          {selectedBatch && (
            <div className="pt-4 border-t">
              <BatchDetailPanel batch={selectedBatch} highlightOrderId={highlightOrderId} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">Lotes de producción</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
              <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
                <FileBarChart className="mr-2 h-4 w-4" />
                Reporte
              </Button>
              <Button onClick={() => setIsCreateBatchModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo lote
              </Button>
            </div>
          </div>

          {isCreateBatchModalOpen && (
            <BatchCreateDialog
              onClose={() => setIsCreateBatchModalOpen(false)}
              onSubmit={handleCreateBatch}
              isSubmitting={isCreating}
            />
          )}

          {isReportModalOpen && <ProductionReportDialog onClose={() => setIsReportModalOpen(false)} />}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                No se pudieron cargar los lotes de producción. Por favor intenta nuevamente.
              </AlertDescription>
            </Alert>
          ) : (
            <BatchList
              batches={activeBatches}
              selectedBatchId={selectedBatchId}
              onSelect={handleSelectBatch}
              onCreateClick={() => setIsCreateBatchModalOpen(true)}
            />
          )}

          {selectedBatch && (
            <div className="pt-4 border-t">
              <BatchDetailPanel batch={selectedBatch} highlightOrderId={highlightOrderId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
