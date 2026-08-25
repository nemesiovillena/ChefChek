'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { GripVertical, User, Trash2, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductionOrder } from '@/hooks/use-production';

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

export function getOrderStatusBadge(status: string) {
  const config = ORDER_STATUS_CONFIG[status] || { label: status, variant: 'secondary' as BadgeVariant };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

interface SortableOrderCardProps {
  order: ProductionOrder;
  assignedNames: string[];
  isHighlighted: boolean;
  highlightedOrderRef?: React.Ref<HTMLDivElement>;
  onPostpone: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function SortableOrderCard({
  order,
  assignedNames,
  isHighlighted,
  highlightedOrderRef,
  onPostpone,
  onComplete,
  onDelete,
}: SortableOrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'p-4 cursor-grab active:cursor-grabbing select-none',
        isHighlighted && 'border-primary ring-2 ring-primary',
        isDragging && 'relative z-10 opacity-90 shadow-lg',
      )}
    >
      <div ref={highlightedOrderRef} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium">{order.title}</span>
              {getOrderStatusBadge(order.status)}
            </div>
            {order.description ? (
              <p className="text-sm text-muted-foreground mb-1 line-clamp-2">{order.description}</p>
            ) : null}
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
              {order.estimatedTime != null ? <span>{order.estimatedTime} min estimados</span> : null}
              {order.actualTime != null ? <span>{order.actualTime} min reales</span> : null}
              {assignedNames.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {assignedNames.join(', ')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {order.status === 'PENDING' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPostpone}
              onPointerDown={(e) => e.stopPropagation()}
              title="Posponer o trasladar a otro lote"
            >
              <CalendarClock className="h-4 w-4" />
            </Button>
          )}
          {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
            <Button size="sm" variant="outline" onClick={onComplete} onPointerDown={(e) => e.stopPropagation()}>
              Completar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            onPointerDown={(e) => e.stopPropagation()}
            title="Eliminar orden"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
