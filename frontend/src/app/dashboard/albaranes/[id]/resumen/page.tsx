'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth.context';
import { useAlbaranDetail } from '@/hooks/use-albaran-detail';
import { updateStatus, deleteAlbaran } from '@/lib/api-albaran';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { AlbaranStatusBadge } from '@/components/albaranes/albaran-status-badge';
import { OcrMethodBadge } from '@/components/albaranes/ocr-method-badge';
import { SupplierPickerDialog } from '@/components/albaranes/supplier-picker-dialog';
import { PurchaseOrderPickerDialog } from '@/components/albaranes/purchase-order-picker-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Building2, Calendar, Warehouse, FileText, Trash2, CheckCircle, Archive, Eye, Edit2, ShoppingCart } from 'lucide-react';
import type { AlbaranStatus } from '@/lib/api-albaran';

export default function AlbaranResumenPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { albaran, loading, error, refetch } = useAlbaranDetail(id);
  const [updating, setUpdating] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const addNotification = useNotification();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  // Marca el query del listado como stale. Sin esto, al volver a /albaranes
  // react-query sirve la caché anterior (staleTime global de 5 min) y el badge
  // de estado queda congelado en el valor previo hasta un refresco manual.
  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
  };
  // Mutaciones que afectan al detalle Y al listado (proveedor, pedido):
  // refresca el detalle visible y marca el listado como stale.
  const handleDetailMutationSuccess = () => {
    invalidateList();
    refetch();
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleStatusChange = async (newStatus: AlbaranStatus) => {
    if (!albaran) return;
    setUpdating(true);
    try {
      await updateStatus(id, newStatus);
      // El estado cambió en BD: invalida la caché del listado para que al
      // volver se muestre el nuevo estado, y refresca el detalle en pantalla.
      invalidateList();
      refetch();
    } catch (err) {
      console.error('Error updating status:', err);
      addNotification({
        type: 'error',
        title: 'No se pudo actualizar',
        message: err instanceof Error ? err.message : 'Error al actualizar estado',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!albaran) return;
    const number = albaran.albaranNumber || '';
    const ok = await confirm({
      title: 'Eliminar albarán',
      description: number
        ? `¿Estás seguro de eliminar el albarán ${number}? Esta acción no se puede deshacer.`
        : '¿Estás seguro de eliminar este albarán? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setUpdating(true);
    try {
      await deleteAlbaran(id);
      // Marca el listado stale antes de navegar: sin esto, el albarán borrado
      // seguiría apareciendo en la caché hasta un refresco manual.
      invalidateList();
      router.push('/dashboard/albaranes');
    } catch (err) {
      console.error('Error deleting albaran:', err);
      addNotification({
        type: 'error',
        title: 'No se pudo eliminar',
        message: err instanceof Error ? err.message : 'Error al eliminar albarán',
      });
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getNextStatusAction = (status: AlbaranStatus): { label: string; nextStatus: AlbaranStatus; icon: typeof CheckCircle } | null => {
    switch (status) {
      case 'PENDIENTE':
        return { label: 'Marcar Revisado', nextStatus: 'REVISADO', icon: Eye };
      case 'REVISADO':
        return { label: 'Confirmar', nextStatus: 'CONFIRMADO', icon: CheckCircle };
      case 'CONFIRMADO':
        return { label: 'Archivar', nextStatus: 'ARCHIVADO', icon: Archive };
      default:
        return null;
    }
  };

  const canDelete = albaran?.status === 'PENDIENTE' || albaran?.status === 'REVISADO';
  const canChangeSupplier = albaran?.status === 'PENDIENTE' || albaran?.status === 'REVISADO';

  if (authLoading || !isAuthenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !albaran) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Albarán no encontrado'}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  const nextAction = getNextStatusAction(albaran.status);

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push('/dashboard/albaranes')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Albaranes
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">Albarán {albaran.albaranNumber || 'Sin número'}</CardTitle>
                  {albaran.internalNumber && (
                    <p className="text-sm text-gray-500 mt-1">Ref: {albaran.internalNumber}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AlbaranStatusBadge status={albaran.status} />
                  <OcrMethodBadge
                    extractionMethod={albaran.ocrRawData?.extraction_method}
                    extractionModel={albaran.ocrRawData?.extraction_model}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Proveedor</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{albaran.supplier?.name || '-'}</p>
                      {canChangeSupplier && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSupplierPickerOpen(true)}
                          className="h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {albaran.supplier?.cifNif && (
                      <p className="text-xs text-gray-400">CIF: {albaran.supplier.cifNif}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha</p>
                    <p className="font-semibold">{formatDate(albaran.date)}</p>
                  </div>
                </div>

                {albaran.warehouse && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Warehouse className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Almacén</p>
                      <p className="font-semibold">{albaran.warehouse.name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Líneas</p>
                    <p className="font-semibold">{albaran.lines?.length || 0} líneas</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Pedido vinculado</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {albaran.purchaseOrder?.orderNumber || 'Sin vincular'}
                      </p>
                      {canChangeSupplier && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOrderPickerOpen(true)}
                          className="h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {albaran.notes && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Notas</p>
                  <p className="text-gray-700">{albaran.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Totals and Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Totales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Base imponible</span>
                <span className="font-medium">{formatCurrency(albaran.base)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA</span>
                <span className="font-medium">{formatCurrency(albaran.vatTotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
                <span>Total</span>
                <span className="text-indigo-600">{formatCurrency(albaran.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextAction && (
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange(nextAction.nextStatus)}
                  disabled={updating}
                >
                  <nextAction.icon className="mr-2 h-4 w-4" />
                  {nextAction.label}
                </Button>
              )}

              {/* El botón de borrado siempre está visible. Si está confirmado/archivado el stock
                  ya está asentado y se deshabilita con tooltip (el span porta el title porque el
                  Button deshabilitado usa pointer-events-none y no recibiría el hover). */}
              <span
                className="block w-full"
                title={canDelete ? undefined : 'No se puede eliminar: el stock ya está asentado (albarán confirmado o archivado)'}
              >
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={updating || !canDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Albarán
                </Button>
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Supplier Picker Dialog */}
      <SupplierPickerDialog
        open={supplierPickerOpen}
        onOpenChange={setSupplierPickerOpen}
        albaranId={id}
        currentSupplierId={albaran.supplier?.id}
        onSuccess={handleDetailMutationSuccess}
      />

      {/* Purchase Order Picker Dialog */}
      <PurchaseOrderPickerDialog
        open={orderPickerOpen}
        onOpenChange={setOrderPickerOpen}
        albaranId={id}
        supplierId={albaran.supplier?.id}
        albaranDate={albaran.date}
        currentPurchaseOrderId={albaran.purchaseOrderId}
        onSuccess={handleDetailMutationSuccess}
      />
    </div>
  );
}
