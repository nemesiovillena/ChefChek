'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Printer, Ban } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  useFoodLabel,
  useVoidFoodLabel,
  useEtiquetadoConfig,
  labelFormatOptions,
  openLabelPdf,
} from '@/hooks/use-food-labels';

export const dynamic = 'force-dynamic';

const fmt = (iso: string | null, withTime = false) =>
  iso
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      }).format(new Date(iso))
    : '—';

const STORAGE_LABEL: Record<string, string> = {
  REFRIGERATED: 'Refrigerado',
  FROZEN: 'Congelado',
  AMBIENT: 'Temperatura ambiente',
};

export default function EtiquetaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();
  const { data: label, isLoading } = useFoodLabel(id);
  const voidLabel = useVoidFoodLabel();
  const etiquetadoConfig = useEtiquetadoConfig();
  const formatOptions = useMemo(
    () => labelFormatOptions(etiquetadoConfig.data),
    [etiquetadoConfig.data],
  );

  const [format, setFormat] = useState('');
  const [copies, setCopies] = useState('1');
  const selectedFormat = format || formatOptions[0]?.value || '';

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }
  if (!label) {
    return <div className="p-8 text-center">Etiqueta no encontrada.</div>;
  }

  const onReprint = () =>
    openLabelPdf(label.id, selectedFormat, Number(copies) || 1, {
      reprint: true,
      onError: (m) => addNotification({ type: 'error', title: 'PDF', message: m }),
    });

  const onVoid = async () => {
    const ok = await confirm({
      title: 'Anular etiqueta',
      description:
        'La etiqueta quedará marcada como anulada (no se borra, sigue en el histórico). ¿Continuar?',
      confirmText: 'Anular',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await voidLabel.mutateAsync({ id: label.id });
      addNotification({ type: 'success', title: 'Etiqueta anulada', message: '' });
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudo anular',
      });
    }
  };

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-[var(--outline-variant)] py-2 text-sm">
      <span className="text-[var(--on-surface-variant)]">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-2xl mx-auto pb-24 pt-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/etiquetado')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-headline-lg text-headline-lg text-primary">
          {label.itemName}
        </h2>
        {label.voidedAt && (
          <span className="rounded-full bg-[var(--error-container)] px-2 py-0.5 text-xs font-semibold text-[var(--on-error-container)]">
            Anulada
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        {row('Lote', <span className="font-mono">{label.lotNumber}</span>)}
        {row('Tipo', label.labelType === 'ELABORATED' ? 'Plato elaborado' : 'Artículo manipulado')}
        {row(
          label.labelType === 'ELABORATED' ? 'Elaboración' : 'Manipulación',
          fmt(label.preparedAt, true),
        )}
        {row('Consumo preferente', fmt(label.useByDate))}
        {label.manufacturerExpiryDate &&
          row('Caducidad fabricante', fmt(label.manufacturerExpiryDate))}
        {label.frozenUseByDate &&
          row(
            'Congelado',
            `${fmt(label.frozenAt)} · consumir antes ${fmt(label.frozenUseByDate)}`,
          )}
        {row(
          'Conservación',
          `${STORAGE_LABEL[label.storageCondition] ?? label.storageCondition}${
            label.storageTempMin != null && label.storageTempMax != null
              ? ` · ${label.storageTempMin}–${label.storageTempMax} °C`
              : ''
          }`,
        )}
        {label.allergens.length > 0 &&
          row('Alérgenos (cód. UE)', label.allergens.join(', '))}
        {(label.quantity != null || label.portions != null) &&
          row(
            'Cantidad',
            [
              label.quantity != null
                ? `${label.quantity} ${label.quantityUnit ?? ''}`.trim()
                : null,
              label.portions != null ? `${label.portions} raciones` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          )}
        {label.sourceLot?.supplier?.name &&
          row('Proveedor', label.sourceLot.supplier.name)}
        {row('Responsable', label.createdByName)}
        {row('Reimpresiones', label.reprintCount)}
        {label.notes && row('Notas', label.notes)}
      </div>

      {label.ingredientLots.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <div className="mb-2 text-sm font-semibold">Lotes de ingredientes</div>
          {label.ingredientLots.map((il) => (
            <div
              key={il.id}
              className="flex justify-between border-b border-[var(--outline-variant)] py-1.5 text-sm"
            >
              <span>{il.productName}</span>
              <span className="font-mono text-[var(--on-surface-variant)]">
                {il.lotNumber || 'Sin especificar'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Formato</span>
          <select
            className="mt-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
            style={{ colorScheme: 'light dark' }}
            value={selectedFormat}
            onChange={(e) => setFormat(e.target.value)}
          >
            {formatOptions.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Copias</span>
          <input
            className="mt-1 w-20 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
            inputMode="numeric"
            value={copies}
            onChange={(e) => setCopies(e.target.value)}
          />
        </label>
        <Button onClick={onReprint}>
          <Printer className="mr-2 h-4 w-4" />
          Reimprimir
        </Button>
        {!label.voidedAt && (
          <Button variant="destructive" onClick={onVoid} disabled={voidLabel.isPending}>
            <Ban className="mr-2 h-4 w-4" />
            Anular
          </Button>
        )}
      </div>
    </div>
  );
}
