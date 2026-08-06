'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { useMiseEnPlaceSheet, type MiseEnPlaceItem } from '@/hooks/use-mise-en-place';
import type { WorkBatch, ProductionOrder } from '@/hooks/use-production';

const STATUS_LABEL: Record<MiseEnPlaceItem['status'], string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  READY: 'Listo',
  VERIFIED: 'Verificado',
};

const NEXT_STATUS: Record<MiseEnPlaceItem['status'], MiseEnPlaceItem['status'] | null> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'READY',
  READY: 'VERIFIED',
  VERIFIED: null,
};

interface OrderMiseEnPlacePanelProps {
  batch: WorkBatch;
  order: ProductionOrder;
}

export default function OrderMiseEnPlacePanel({ batch, order }: OrderMiseEnPlacePanelProps) {
  const {
    sheet,
    isLoading,
    createSheet,
    isCreatingSheet,
    addItem,
    isAddingItem,
    updateItemStatus,
    verifySheet,
    isVerifying,
  } = useMiseEnPlaceSheet(order.id);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('ud');

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!sheet) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Esta orden todavía no tiene hoja de mise en place.</p>
        <Button
          size="sm"
          variant="outline"
          disabled={isCreatingSheet}
          onClick={() =>
            createSheet({ batchId: batch.id, orderId: order.id, zone: batch.kitchenZone, checklists: [] })
          }
        >
          Crear hoja de mise en place
        </Button>
      </div>
    );
  }

  const allVerified = sheet.items.length > 0 && sheet.items.every((item) => item.status === 'VERIFIED');
  const canAddItem = description.trim() !== '' && quantity.trim() !== '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold">Mise en place — {sheet.zone}</h5>
        {sheet.completedAt ? (
          <Badge variant="default">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verificada
          </Badge>
        ) : (
          <Button size="sm" variant="outline" disabled={!allVerified || isVerifying} onClick={() => verifySheet()}>
            Verificar hoja
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {sheet.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin items todavía.</p>
        ) : (
          sheet.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm rounded border p-2">
              <span>
                {item.description} — {item.quantity} {item.unit}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={item.status === 'VERIFIED' ? 'default' : 'secondary'}>
                  {STATUS_LABEL[item.status]}
                </Badge>
                {NEXT_STATUS[item.status] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateItemStatus({ itemId: item.id, status: NEXT_STATUS[item.status]! })}
                  >
                    Avanzar
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="w-20">
          <Input type="number" min="0" placeholder="Cant." value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="w-20">
          <Input placeholder="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <Button
          size="sm"
          disabled={!canAddItem || isAddingItem}
          onClick={async () => {
            await addItem({ orderId: order.id, description, quantity: Number(quantity), unit });
            setDescription('');
            setQuantity('');
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
