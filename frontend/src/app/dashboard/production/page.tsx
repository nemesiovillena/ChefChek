'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

type ProductionTab = 'batches' | 'staff';

export default function ProductionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { batches, isLoading, error, refetch, createBatch, isCreating } = useProductionBatches();
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProductionTab>('batches');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const handleCreateBatch = async (input: CreateWorkBatchInput) => {
    await createBatch(input);
    setIsCreateBatchModalOpen(false);
  };

  const handleSelectBatch = (batch: WorkBatch) => {
    setSelectedBatchId((current) => (current === batch.id ? null : batch.id));
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Producción</h1>
        <p className="text-muted-foreground mt-1">
          Lotes de producción y órdenes de trabajo de cocina
        </p>
      </div>

      <div role="tablist" className="mb-6 flex gap-2 border-b">
        <button
          role="tab"
          aria-selected={activeTab === 'batches'}
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'batches' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Lotes y órdenes
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'staff'}
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'staff' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Personal
        </button>
      </div>

      {activeTab === 'staff' ? (
        <StaffList />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Lotes de producción</h2>
            <div className="flex gap-2">
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
              batches={batches}
              selectedBatchId={selectedBatchId}
              onSelect={handleSelectBatch}
              onCreateClick={() => setIsCreateBatchModalOpen(true)}
            />
          )}

          {selectedBatch && (
            <div className="pt-4 border-t">
              <BatchDetailPanel batch={selectedBatch} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
