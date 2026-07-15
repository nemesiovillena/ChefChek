'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSuppliers } from '@/hooks/use-suppliers';
import {
  usePriceDeviations,
  usePriceTolerance,
  useSetPriceTolerance,
  useUpdatePriceDeviation,
  type PriceDeviation,
  type PriceDeviationStatus,
} from '@/hooks/use-price-deviations';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const STATUS_META: Record<PriceDeviationStatus, { label: string; className: string }> = {
  PENDIENTE: {
    label: 'Pendiente',
    className: 'bg-[var(--error-container)] text-[var(--on-error-container)]',
  },
  RECLAMADA: {
    label: 'Reclamada',
    className: 'bg-[var(--secondary-container)] text-[var(--on-surface)]',
  },
  RESUELTA: {
    label: 'Resuelta',
    className: 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
  },
};

const STATUS_OPTIONS: PriceDeviationStatus[] = ['PENDIENTE', 'RECLAMADA', 'RESUELTA'];

/**
 * Panel de desviaciones de precio pactado (docs/pdr-modulo-compras.md §F5):
 * artículo/proveedor, pactado vs recibido, % y origen (albarán/pedido), con
 * estado gestionable y tolerancia % global editable por ADMIN.
 */
export function PriceDeviationPanel({ canManage }: { canManage: boolean }) {
  const addNotification = useNotification();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState<PriceDeviationStatus | ''>('');

  const { data: deviations, isLoading, error } = usePriceDeviations({
    supplierId,
    status,
  });
  const updateMut = useUpdatePriceDeviation();

  const { data: toleranceData } = usePriceTolerance();
  const setToleranceMut = useSetPriceTolerance();
  const [toleranceInput, setToleranceInput] = useState<string | null>(null);
  const toleranceValue =
    toleranceInput ?? String(toleranceData?.tolerancePercent ?? 0);

  const handleSaveTolerance = async () => {
    const value = Number(toleranceValue);
    if (isNaN(value) || value < 0 || value > 100) {
      addNotification({ type: 'error', title: 'Error', message: 'Tolerancia inválida (0-100)' });
      return;
    }
    try {
      await setToleranceMut.mutateAsync(value);
      setToleranceInput(null);
      addNotification({ type: 'success', title: 'Tolerancia guardada', message: `${value}%` });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const handleStatusChange = async (deviation: PriceDeviation, next: PriceDeviationStatus) => {
    try {
      await updateMut.mutateAsync({ id: deviation.id, status: next, note: deviation.note ?? undefined });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo cambiar el estado',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <label className="text-sm font-medium text-[var(--on-surface)]">
            Tolerancia global de desviación
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={toleranceValue}
            onChange={(e) => setToleranceInput(e.target.value)}
            className="w-20 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1.5 text-sm text-right text-[var(--on-surface)]"
          />
          <span className="text-sm text-[var(--on-surface-variant)]">%</span>
          <button
            onClick={handleSaveTolerance}
            disabled={setToleranceMut.isPending}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Guardar
          </button>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Solo se registra desviación si el precio recibido supera el pactado más este margen.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          <option value="">Todos los proveedores</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PriceDeviationStatus | '')}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando desviaciones...
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
          No se pudieron cargar las desviaciones: {error.message}
        </div>
      ) : (deviations ?? []).length === 0 ? (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 text-center text-[var(--on-surface-variant)]">
          Sin desviaciones registradas. Fija un precio pactado en la ficha de un artículo (pestaña Proveedor) para empezar a controlarlas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--outline-variant)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-[var(--surface-container)] text-left text-[var(--on-surface-variant)]">
                <th className="px-4 py-3 font-medium">Artículo</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 text-right font-medium">Pactado</th>
                <th className="px-4 py-3 text-right font-medium">Recibido</th>
                <th className="px-4 py-3 text-right font-medium">Desviación</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(deviations ?? []).map((deviation) => {
                const meta = STATUS_META[deviation.status];
                return (
                  <tr
                    key={deviation.id}
                    className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                  >
                    <td className="px-4 py-2 text-[var(--on-surface)]">
                      {deviation.offer.product.name}
                    </td>
                    <td className="px-4 py-2 text-[var(--on-surface-variant)]">
                      {deviation.offer.supplier.name}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--on-surface)]">
                      {euro.format(deviation.agreedPrice)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-[var(--error)]">
                      {euro.format(deviation.receivedPrice)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-[var(--error)]">
                      +{deviation.deviationPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-[var(--on-surface-variant)]">
                      {deviation.albaran?.albaranNumber || deviation.albaran?.internalNumber || deviation.purchaseOrder?.orderNumber || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {canManage ? (
                        <select
                          value={deviation.status}
                          onChange={(e) => handleStatusChange(deviation, e.target.value as PriceDeviationStatus)}
                          disabled={updateMut.isPending}
                          className={`rounded-full border-0 px-3 py-1 text-xs font-medium ${meta.className}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
