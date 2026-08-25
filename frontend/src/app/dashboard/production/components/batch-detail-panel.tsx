'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Plus, Loader2, Pencil } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useProductionBatches, useProductionOrders } from '@/hooks/use-production';
import { useStaffMembers } from '@/hooks/use-production-staff';
import type { CreateWorkBatchInput, ProductionOrder, WorkBatch } from '@/hooks/use-production';
import OrderCreateDialog from './order-create-dialog';
import BatchCreateDialog from './batch-create-dialog';
import { SortableOrderCard } from './sortable-order-card';
import { PostponeTaskDialog } from '../tasks/postpone-task-dialog';

interface BatchDetailPanelProps {
  batch: WorkBatch;
  highlightOrderId?: string | null;
}

export default function BatchDetailPanel({ batch, highlightOrderId }: BatchDetailPanelProps) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const highlightedOrderRef = useRef<HTMLDivElement | null>(null);
  const { completeBatch, isCompleting, updateBatch, isUpdating } = useProductionBatches();
  const {
    orders,
    isLoading: ordersLoading,
    createOrder,
    isCreating,
    completeOrder,
    deleteOrder,
    reorderOrders,
  } = useProductionOrders(batch.id);
  const { staff } = useStaffMembers();
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [postponingOrder, setPostponingOrder] = useState<ProductionOrder | null>(null);
  const canEditBatch = batch.status !== 'COMPLETED' && batch.status !== 'CANCELLED';
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Mapa staffId → nombre para resolver las asignaciones sin otra petición.
  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staff) map.set(s.id, s.name);
    return map;
  }, [staff]);

  // Llegada desde el dashboard con una orden concreta: la centra en pantalla
  // en vez de dejar que el trabajador la busque entre todas las del lote.
  useEffect(() => {
    if (highlightOrderId && highlightedOrderRef.current) {
      highlightedOrderRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightOrderId, orders]);

  const handleUpdateBatch = async (input: CreateWorkBatchInput) => {
    await updateBatch({ batchId: batch.id, input });
    setIsEditDialogOpen(false);
  };

  const handleCompleteBatch = async () => {
    const ok = await confirm({
      title: 'Completar lote',
      description: `¿Completar el lote ${batch.batchNumber}? Esta acción genera el reporte final.`,
    });
    if (!ok) return;
    await completeBatch(batch.id);
  };

  const handleCompleteOrder = async (orderId: string, estimatedTime?: number | null) => {
    await completeOrder({ orderId, actualTime: estimatedTime ?? 0 });
  };

  const handleDeleteOrder = async (orderId: string, orderTitle: string) => {
    const ok = await confirm({
      title: 'Eliminar orden',
      description: `¿Eliminar la orden "${orderTitle}"?`,
      variant: 'destructive',
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    await deleteOrder(orderId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orders.findIndex((o) => o.id === active.id);
    const newIndex = orders.findIndex((o) => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orders, oldIndex, newIndex);
    queryClient.setQueryData(['production-orders', batch.id], reordered);
    reorderOrders(reordered.map((o) => o.id));
  };

  return (
    <Card className="p-6 space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <CardTitle>{batch.batchNumber}</CardTitle>
          <div className="flex gap-2">
            {canEditBatch && (
              <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar lote
              </Button>
            )}
            {canEditBatch && (
              <Button size="sm" onClick={handleCompleteBatch} disabled={isCompleting}>
                Completar lote
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Órdenes de producción</h4>
          <Button size="sm" variant="outline" onClick={() => setIsOrderDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Button>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-8 flex flex-col items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Sin órdenes de producción en este lote</p>
          </Card>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3">
                {orders.map((order) => {
                  const assignedNames = (order.assignedStaffIds ?? [])
                    .map((id) => staffNameById.get(id))
                    .filter((n): n is string => Boolean(n));
                  const isHighlighted = order.id === highlightOrderId;
                  return (
                    <SortableOrderCard
                      key={order.id}
                      order={order}
                      assignedNames={assignedNames}
                      isHighlighted={isHighlighted}
                      highlightedOrderRef={isHighlighted ? highlightedOrderRef : undefined}
                      onPostpone={() => setPostponingOrder(order)}
                      onComplete={() => handleCompleteOrder(order.id, order.estimatedTime)}
                      onDelete={() => handleDeleteOrder(order.id, order.title)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {isEditDialogOpen && (
        <BatchCreateDialog
          initialBatch={batch}
          isSubmitting={isUpdating}
          onClose={() => setIsEditDialogOpen(false)}
          onSubmit={handleUpdateBatch}
        />
      )}

      {postponingOrder && (
        <PostponeTaskDialog
          task={postponingOrder}
          open={Boolean(postponingOrder)}
          onOpenChange={(open) => {
            if (!open) setPostponingOrder(null);
          }}
        />
      )}

      {isOrderDialogOpen && (
        <OrderCreateDialog
          batchId={batch.id}
          isSubmitting={isCreating}
          onClose={() => setIsOrderDialogOpen(false)}
          onSubmit={async (input) => {
            await createOrder(input);
            setIsOrderDialogOpen(false);
          }}
        />
      )}
    </Card>
  );
}
