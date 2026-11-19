'use client';

import { useState } from 'react';
import { FileText, Link2, Loader2, Undo2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Albaran } from '@/lib/api-albaran';
import {
  SETTLEMENT_LABELS,
  coverAlbaranReturn,
  discardAlbaranReturn,
  formatReturnQuantity,
  unapplyAlbaranReturn,
  type AlbaranReturn,
} from '@/lib/api-albaran-returns';
import {
  openReturnReceipt,
  useAlbaranReturns,
  useInvalidateAlbaranReturns,
  usePendingCreditNoteReturns,
} from '@/hooks/use-albaran-returns';
import { ApplyReturnDialog } from './apply-return-dialog';

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

/** Ids de las líneas que son devoluciones aplicadas (para pintarlas en rojo). */
export function returnLineIds(returns: AlbaranReturn[] | undefined): Set<string> {
  return new Set((returns ?? []).map((r) => r.appliedLineId).filter((id): id is string => !!id));
}

function settlementText(ret: AlbaranReturn): string {
  if (ret.settlement === 'CREDIT_NOTE') {
    return ret.creditNoteSettledAt ? 'Abonado en abono aparte' : 'Abono aparte pendiente';
  }
  return ret.settlement ? SETTLEMENT_LABELS[ret.settlement] : '';
}

interface AlbaranReturnsPanelProps {
  albaran: Albaran;
  onChanged: () => void;
}

/**
 * Devoluciones al proveedor del albarán. Arriba, en ámbar, lo que cocina anotó
 * al recibir y oficina aún no ha aplicado (bloquea confirmar). Debajo, las ya
 * aplicadas, con justificante. Si el albarán es un abono del proveedor y hay
 * devoluciones esperando abono aparte, permite enlazarlas.
 */
export function AlbaranReturnsPanel({ albaran, onChanged }: AlbaranReturnsPanelProps) {
  const addNotification = useNotification();
  const invalidate = useInvalidateAlbaranReturns();
  const { data: returns = [] } = useAlbaranReturns(albaran.id);
  const [applying, setApplying] = useState<AlbaranReturn | 'new' | null>(null);
  const [discarding, setDiscarding] = useState<{ id: string; note: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const lines = albaran.lines ?? [];
  const appliedIds = returnLineIds(returns);
  const coveredIds = new Set(returns.map((r) => r.creditNoteLineId).filter(Boolean));
  const returnableLines = lines.filter(
    (l) => l.lineStatus !== 'RECHAZADO' && l.quantity > 0 && !appliedIds.has(l.id),
  );
  const editable = albaran.status !== 'ARCHIVADO';
  const beforeConfirm = albaran.status === 'PENDIENTE' || albaran.status === 'REVISADO';

  const pending = returns.filter((r) => r.status === 'PENDIENTE');
  const settled = returns.filter((r) => r.status !== 'PENDIENTE');

  // Abono del proveedor: líneas negativas propias (no devoluciones aplicadas aquí).
  const creditLines = lines.filter((l) => l.quantity < 0 && !appliedIds.has(l.id));
  const { data: pendingCredit = [] } = usePendingCreditNoteReturns(
    albaran.supplier?.id,
    beforeConfirm && creditLines.length > 0,
  );
  const linkable = pendingCredit.filter((r) => r.albaranId !== albaran.id);

  const refresh = () => {
    invalidate(albaran.id);
    onChanged();
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      addNotification({ type: 'success', title: success, message: '' });
      refresh();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo completar',
        message: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setBusy(null);
    }
  };

  const receipt = (ret: AlbaranReturn) =>
    void openReturnReceipt(albaran.id, ret.id, (message) =>
      addNotification({ type: 'error', title: 'Justificante', message }),
    );

  const closeDialog = () => setApplying(null);

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Undo2 className="h-4 w-4" />
            {pending.length === 1 ? 'Devolución anotada en recepción' : `${pending.length} devoluciones anotadas en recepción`}
            <span className="font-normal">· aplícala o descártala para poder confirmar</span>
          </p>
          {pending.map((ret) => (
            <div key={ret.id} className="space-y-2 rounded-lg bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {ret.quantity !== null && `${formatReturnQuantity(ret.quantity, ret.unit)} · `}
                    {ret.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ret.reason} · {ret.reportedByName} · {fmtDateTime(ret.reportedAt)}
                    {ret.sictedIncidentId && ' · incidencia SICTED creada'}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setApplying(ret)} className="max-sm:h-10">
                      Aplicar a línea…
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDiscarding({ id: ret.id, note: '' })}
                      className="max-sm:h-10"
                    >
                      Descartar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => receipt(ret)} className="max-sm:h-10">
                      <FileText className="mr-1 h-4 w-4" />
                      Justificante
                    </Button>
                  </div>
                )}
              </div>
              {discarding?.id === ret.id && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    autoFocus
                    value={discarding.note}
                    onChange={(e) => setDiscarding({ id: ret.id, note: e.target.value })}
                    placeholder="Por qué se descarta (p. ej. al final no se devolvió)"
                    className="text-base"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!discarding.note.trim() || busy === ret.id}
                    onClick={() =>
                      run(
                        ret.id,
                        () => discardAlbaranReturn(albaran.id, ret.id, discarding.note.trim()),
                        'Devolución descartada',
                      ).then(() => setDiscarding(null))
                    }
                  >
                    {busy === ret.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Descartar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDiscarding(null)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <div className="space-y-1 rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">Devoluciones al proveedor</p>
          {settled.map((ret) => (
            <div key={ret.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
              <div className="min-w-0 text-sm">
                <p className={ret.status === 'DESCARTADA' ? 'text-muted-foreground line-through' : 'text-red-700 dark:text-red-400'}>
                  ↩ {ret.quantity !== null && `${formatReturnQuantity(ret.quantity, ret.unit)} · `}
                  {ret.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ret.reason} · {ret.reportedByName} · {fmtDateTime(ret.reportedAt)} ·{' '}
                  {ret.status === 'DESCARTADA' ? `Descartada: ${ret.discardNote ?? ''}` : settlementText(ret)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => receipt(ret)}>
                  <FileText className="mr-1 h-4 w-4" />
                  Justificante
                </Button>
                {ret.status === 'APLICADA' && beforeConfirm && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === ret.id}
                    onClick={() => run(ret.id, () => unapplyAlbaranReturn(albaran.id, ret.id), 'Devolución deshecha')}
                  >
                    Deshacer
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {linkable.length > 0 && (
        <div className="space-y-2 rounded-xl border border-indigo-300 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            <Link2 className="h-4 w-4" />
            ¿Este abono cubre alguna devolución pendiente de {albaran.supplier?.name}?
          </p>
          <p className="text-xs text-muted-foreground">
            Enlázala con su línea del abono: así el stock no se resta dos veces y esa línea no se envía a Cuiner.
          </p>
          {linkable.map((ret) => {
            const linkedLineId = ret.creditNoteLineId && creditLines.some((l) => l.id === ret.creditNoteLineId) ? ret.creditNoteLineId : '';
            return (
              <div key={ret.id} className="flex flex-col gap-2 rounded-lg bg-background p-2 sm:flex-row sm:items-center">
                <span className="flex-1 text-sm">
                  {formatReturnQuantity(ret.quantity, ret.unit)} · {ret.description}
                  <span className="block text-xs text-muted-foreground">
                    Albarán {ret.albaran.albaranNumber || ret.albaran.internalNumber} · {ret.reason}
                  </span>
                </span>
                <select
                  value={linkedLineId}
                  disabled={busy === ret.id}
                  onChange={(e) =>
                    run(
                      ret.id,
                      () => coverAlbaranReturn(albaran.id, e.target.value || linkedLineId, e.target.value ? ret.id : null),
                      e.target.value ? 'Abono enlazado con la devolución' : 'Enlace quitado',
                    )
                  }
                  className="h-10 rounded-md border border-input bg-background px-2 text-base sm:w-72"
                >
                  <option value="">Sin enlazar</option>
                  {creditLines
                    .filter((l) => !coveredIds.has(l.id) || l.id === linkedLineId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.description} · {formatReturnQuantity(l.quantity, l.unit)}
                      </option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {editable && returnableLines.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setApplying('new')}
          className="border-amber-400 text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
        >
          <Undo2 className="mr-1 h-4 w-4" />
          Devolver un artículo
        </Button>
      )}

      {applying !== null && (
        <ApplyReturnDialog
          albaranId={albaran.id}
          lines={returnableLines}
          pendingReturn={applying && applying !== 'new' ? applying : undefined}
          onClose={closeDialog}
          onDone={refresh}
        />
      )}
    </div>
  );
}
