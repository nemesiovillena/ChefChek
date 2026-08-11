'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Package, Plus, Loader2, User, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/contexts/confirm.context';
import { useProductionBatches, useProductionOrders } from '@/hooks/use-production';
import { useStaffMembers } from '@/hooks/use-production-staff';
import type { WorkBatch } from '@/hooks/use-production';
import { cn } from '@/lib/utils';
import OrderCreateDialog from './order-create-dialog';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

// PENDING lleva colores propios (no una variant estándar) porque es el
// estado que más debe llamar la atención del trabajador en cocina.
const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant; className?: string }> = {
  PENDING: {
    label: 'Pendiente',
    variant: 'outline',
    className:
      'border-amber-400 bg-amber-100 text-amber-900 font-semibold dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  },
  IN_PROGRESS: { label: 'En progreso', variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'default' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

function getOrderStatusBadge(status: string) {
  const config = ORDER_STATUS_CONFIG[status] || { label: status, variant: 'secondary' as BadgeVariant };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

interface BatchDetailPanelProps {
  batch: WorkBatch;
  highlightOrderId?: string | null;
}

export default function BatchDetailPanel({ batch, highlightOrderId }: BatchDetailPanelProps) {
  const confirm = useConfirm();
  const highlightedOrderRef = useRef<HTMLDivElement | null>(null);
  const { completeBatch, isCompleting } = useProductionBatches();
  const {
    orders,
    isLoading: ordersLoading,
    createOrder,
    isCreating,
    completeOrder,
    deleteOrder,
  } = useProductionOrders(batch.id);
  const { staff } = useStaffMembers();
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

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

  return (
    <Card className="p-6 space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <CardTitle>{batch.batchNumber}</CardTitle>
          <div className="flex gap-2">
            {batch.status !== 'COMPLETED' && batch.status !== 'CANCELLED' && (
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
            {orders.map((order) => {
              const assignedNames = (order.assignedStaffIds ?? [])
                .map((id) => staffNameById.get(id))
                .filter((n): n is string => Boolean(n));
              const isHighlighted = order.id === highlightOrderId;
              return (
                <Card
                  key={order.id}
                  className={cn('p-4', isHighlighted && 'border-primary ring-2 ring-primary')}
                >
                  <div
                    ref={isHighlighted ? highlightedOrderRef : undefined}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium">{order.title}</span>
                        {getOrderStatusBadge(order.status)}
                      </div>
                      {order.description ? (
                        <p className="text-sm text-muted-foreground mb-1 line-clamp-2">{order.description}</p>
                      ) : null}
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                        {order.estimatedTime != null ? (
                          <span>{order.estimatedTime} min estimados</span>
                        ) : null}
                        {order.actualTime != null ? <span>{order.actualTime} min reales</span> : null}
                        {assignedNames.length > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {assignedNames.join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
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
                        variant="outline"
                        onClick={() => handleDeleteOrder(order.id, order.title)}
                        title="Eliminar orden"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
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
