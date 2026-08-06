'use client';

import { Card } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Factory, Clock, Plus } from 'lucide-react';
import type { WorkBatch } from '@/hooks/use-production';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PLANNED: { label: 'Planificado', variant: 'secondary' },
  IN_PROGRESS: { label: 'En progreso', variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'default' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

function getBatchStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'secondary' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

interface BatchListProps {
  batches: WorkBatch[];
  selectedBatchId: string | null;
  onSelect: (batch: WorkBatch) => void;
  onCreateClick: () => void;
}

export default function BatchList({ batches, selectedBatchId, onSelect, onCreateClick }: BatchListProps) {
  if (batches.length === 0) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center">
        <Factory className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Sin lotes de producción</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Crea tu primer lote para empezar a gestionar la producción
        </p>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Crear primer lote
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {batches.map((batch) => (
        <Card
          key={batch.id}
          onClick={() => onSelect(batch)}
          className={`p-6 cursor-pointer transition-colors ${
            selectedBatchId === batch.id ? 'border-primary' : 'hover:bg-muted/40'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">{batch.batchNumber}</h3>
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" />
                  {new Date(batch.scheduledFor).toLocaleString()}
                </Badge>
                {getBatchStatusBadge(batch.status)}
              </div>
              {batch.notes && <p className="text-sm text-muted-foreground mb-2">{batch.notes}</p>}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Zona: {batch.kitchenZone}</span>
                <span>Prioridad: {batch.priority}</span>
                {batch.responsible.length > 0 && <span>Responsables: {batch.responsible.join(', ')}</span>}
                <span>{batch.productionOrders?.length ?? 0} orden(es)</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
