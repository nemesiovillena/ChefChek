'use client';

import type { WorkBatch, ProductionOrder } from '@/hooks/use-production';
import OrderMiseEnPlacePanel from './order-mise-en-place-panel';
import OrderTasksPanel from './order-tasks-panel';

interface OrderDetailPanelProps {
  batch: WorkBatch;
  order: ProductionOrder;
}

export default function OrderDetailPanel({ batch, order }: OrderDetailPanelProps) {
  return (
    <div className="mt-3 grid gap-4 border-t pt-3 md:grid-cols-2">
      <OrderMiseEnPlacePanel batch={batch} order={order} />
      <OrderTasksPanel orderId={order.id} />
    </div>
  );
}
