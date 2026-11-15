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
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Base {formatEuros(data.base)} · mesa, comensales y forma de pago llegarán con la próxima versión del conector.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
