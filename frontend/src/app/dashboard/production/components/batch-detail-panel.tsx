'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Package, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/contexts/confirm.context';
import { useProductionBatches, useProductionOrders } from '@/hooks/use-production';
import type { WorkBatch } from '@/hooks/use-production';
import OrderCreateDialog from './order-create-dialog';
import OrderDetailPanel from './order-detail-panel';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  IN_PROGRESS: { label: 'En progreso', variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'default' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

function getOrderStatusBadge(status: string) {
  const config = ORDER_STATUS_CONFIG[status] || { label: status, variant: 'secondary' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

interface BatchDetailPanelProps {
  batch: WorkBatch;
}

export default function BatchDetailPanel({ batch }: BatchDetailPanelProps) {
  const confirm = useConfirm();
  const { startBatch, completeBatch, isStarting, isCompleting } = useProductionBatches();
  const {
    orders,
    isLoading: ordersLoading,
    createOrder,
    isCreating,
    startOrder,
    completeOrder,
  } = useProductionOrders(batch.id);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleStartBatch = async () => {
    const ok = await confirm({ title: 'Iniciar lote', description: `¿Iniciar el lote ${batch.batchNumber}?` });
    if (!ok) return;
    await startBatch(batch.id);
  };

  const handleCompleteBatch = async () => {
    const ok = await confirm({
      title: 'Completar lote',
      description: `¿Completar el lote ${batch.batchNumber}? Esta acción genera el reporte final.`,
    });
    if (!ok) return;
    await completeBatch(batch.id);
  };

  const handleCompleteOrder = async (orderId: string, orderNumber: string) => {
    let actualTime = 0;
    const ok = await confirm({
      title: 'Completar orden',
      description: `Introduce el tiempo real empleado en la orden ${orderNumber}.`,
      children: (
        <Input
          type="number"
          min="0"
          autoFocus
          placeholder="Minutos"
          onChange={(e) => {
            actualTime = Number(e.target.value);
          }}
        />
      ),
    });
    if (!ok || !Number.isFinite(actualTime) || actualTime <= 0) return;
    await completeOrder({ orderId, actualTime });
  };

  return (
    <Card className="p-6 space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <CardTitle>{batch.batchNumber}</CardTitle>
          <div className="flex gap-2">
            {batch.status === 'PLANNED' && (
              <Button size="sm" onClick={handleStartBatch} disabled={isStarting}>
                Iniciar lote
              </Button>
            )}
            {batch.status === 'IN_PROGRESS' && (
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
          <div className="grid gap-3">
            {orders.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{order.title}</span>
                      {getOrderStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.quantity != null && order.unit ? `${order.quantity} ${order.unit} · ` : ''}
                      {order.estimatedTime} min estimados
                      {order.actualTime != null && ` · ${order.actualTime} min reales`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'PENDING' && (
                      <Button size="sm" variant="outline" onClick={() => startOrder(order.id)}>
                        Iniciar
                      </Button>
                    )}
                    {order.status === 'IN_PROGRESS' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteOrder(order.id, order.orderNumber)}
                      >
                        Completar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
                    >
                      {expandedOrderId === order.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {expandedOrderId === order.id && <OrderDetailPanel batch={batch} order={order} />}
              </Card>
            ))}
          </div>
        )}
      </CardContent>

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
