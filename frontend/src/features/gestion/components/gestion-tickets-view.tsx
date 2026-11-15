'use client';

import { useDeferredValue, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import PaginationControls from '@/components/shared/pagination-controls';
import { type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import { type DateRange, useGestionTickets } from '../api/gestion-api';
import { formatDay, formatEuros, formatQty } from '../gestion-format';
import { PeriodPicker } from './period-picker';
import { TicketDetailDialog } from './ticket-detail-dialog';

/** Tickets del TPV: periodo, búsqueda por número o por plato, y detalle al pulsar. */
export function GestionTicketsView() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openId, setOpenId] = useState<number | null>(null);
  const valid = range.from <= range.to;
  // Sin una petición por tecla: React espera a que se deje de escribir.
  const deferredSearch = useDeferredValue(search.trim());
  const { data, isLoading, isFetching, error } = useGestionTickets(range, page, pageSize, deferredSearch, valid);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <PeriodPicker
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
            setPage(1);
          }}
        />
        <label className="flex flex-col">
          <span className={labelCls}>Buscar</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <input
              className={`${inputCls} pl-9`}
              value={search}
              placeholder="Nº de ticket o nombre de un plato"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
      </div>

      {!valid && <p className="text-sm text-[var(--error)]">La fecha «Desde» es posterior a «Hasta».</p>}
      {error && <p className="text-sm text-[var(--error)]">No se pudieron cargar los tickets: {error.message}</p>}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />}

      {data && (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)]">
          <ul className="divide-y divide-[var(--outline-variant)]">
            {data.items.length === 0 && (
              <li className="p-6 text-center text-sm text-[var(--on-surface-variant)]">Sin tickets en este periodo.</li>
            )}
            {data.items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-container-high)]"
                >
                  <span>
                    <span className="block font-medium text-[var(--on-surface)]">Ticket {t.id}</span>
                    <span className="block text-xs text-[var(--on-surface-variant)]">
                      {formatDay(t.date)} · {t.lines} líneas · {formatQty(t.units)} uds.
                      {t.hasVoids && ' · con anulaciones'}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--on-surface)]">{formatEuros(t.total)}</span>
                </button>
              </li>
            ))}
          </ul>
          <PaginationControls
            variant="attached"
            page={data.page}
            totalPages={totalPages}
            total={data.total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            emptyLabel="Sin tickets"
          />
          {isFetching && <Loader2 className="mx-auto mb-3 h-4 w-4 animate-spin text-[var(--on-surface-variant)]" />}
        </div>
      )}

      <TicketDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
