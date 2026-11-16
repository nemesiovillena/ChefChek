'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGestionTicket } from '../api/gestion-api';
import { formatDay, formatEuros, formatQty } from '../gestion-format';

/** Líneas de un ticket: anuladas tachadas, invitaciones marcadas. */
export function TicketDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useGestionTicket(id);
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Ticket {id}
            {data && <span className="ml-2 font-normal text-[var(--on-surface-variant)]">{formatDay(data.date)}</span>}
          </DialogTitle>
        </DialogHeader>
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
        {error && <p className="text-sm text-[var(--error)]">{error.message}</p>}
        {data && (
          <>
            <ul className="divide-y divide-[var(--outline-variant)] text-sm">
              {data.lines.map((l) => (
                <li key={l.line} className={`flex justify-between gap-3 py-2 ${l.voided ? 'opacity-60' : ''}`}>
                  <span className={l.voided ? 'line-through' : ''}>
                    {formatQty(l.units)} × {l.name}
                    {l.voided && <span className="ml-2 text-xs no-underline">(anulada)</span>}
                    {l.invited && <span className="ml-2 text-xs">(invitación)</span>}
                    {l.type === 'M' && <span className="ml-2 text-xs text-[var(--on-surface-variant)]">menú</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{l.total === null ? '—' : formatEuros(l.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-[var(--outline-variant)] pt-3 font-semibold">
              <span>Total (sin anuladas)</span>
              <span className="tabular-nums">{formatEuros(data.total)}</span>
            </div>
            {data.payments.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm">
                {data.payments.map((p, i) => (
                  <li key={i} className={`flex justify-between ${p.voided ? 'line-through opacity-60' : ''}`}>
                    <span className="text-[var(--on-surface-variant)]">
                      Cobro {p.method.charAt(0) + p.method.slice(1).toLowerCase()}
                    </span>
                    <span className="tabular-nums">{formatEuros(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
              Base {formatEuros(data.base)}
              {data.header
                ? [
                    data.header.table && `mesa ${data.header.table}`,
                    data.header.diners ? `${data.header.diners} comensales` : null,
                    data.header.shift && data.header.shift.toLowerCase(),
                    data.header.openedAt &&
                      `${data.header.openedAt}${data.header.closedAt ? `–${data.header.closedAt}` : ''}`,
                    data.header.waiter && `camarero ${data.header.waiter}`,
                  ]
                    .filter(Boolean)
                    .map((x) => ` · ${x}`)
                    .join('')
                : ' · sin datos de mesa ni cobros todavía (llegan con la versión nueva del conector)'}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
