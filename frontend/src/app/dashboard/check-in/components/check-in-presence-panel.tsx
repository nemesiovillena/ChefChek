'use client';

import { MapPinOff } from 'lucide-react';
import { usePresence } from '@/hooks/use-check-in';
import { GEOFENCE_LABELS, STATUS_LABELS, formatTime } from '@/lib/check-in-punch';
import type { PresenceEntry, WorkStatus } from '@/lib/check-in-types';
import { cardCls } from './check-in-form-styles';

const ORDER: WorkStatus[] = ['IN', 'ON_BREAK', 'OUT'];
const DOT: Record<WorkStatus, string> = {
  IN: 'bg-[var(--primary)]',
  ON_BREAK: 'bg-amber-500',
  OUT: 'bg-[var(--outline-variant)]',
};

function Row({ entry }: { entry: PresenceEntry }) {
  const warning = entry.lastPunch ? GEOFENCE_LABELS[entry.lastPunch.geofenceStatus] : null;
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[entry.status]}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.name}</span>
        <span className="block truncate text-sm text-[var(--on-surface-variant)]">
          {[entry.jobTitle, entry.lastPunch?.locationName].filter(Boolean).join(' · ') || '—'}
        </span>
      </span>
      <span className="shrink-0 text-right text-sm text-[var(--on-surface-variant)]">
        {entry.status !== 'OUT' && entry.since && <span className="block">desde {formatTime(entry.since)}</span>}
        {entry.status !== 'OUT' && warning && (
          <span className="flex items-center justify-end gap-1 text-[var(--error)]">
            <MapPinOff className="h-4 w-4" /> {warning}
          </span>
        )}
      </span>
    </li>
  );
}

/** Quién está trabajando ahora mismo. Solo para quien gestiona el módulo. */
export function CheckInPresencePanel() {
  const { data: presence, isLoading } = usePresence(true);
  if (isLoading || !presence) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (presence.length === 0) {
    return <p className="text-[var(--on-surface-variant)]">Aún no hay empleados dados de alta.</p>;
  }

  const count = (status: WorkStatus) => presence.filter((p) => p.status === status).length;

  return (
    <div className={cardCls}>
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        {ORDER.map((status) => (
          <span key={status} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${DOT[status]}`} aria-hidden />
            {STATUS_LABELS[status]}: <strong>{count(status)}</strong>
          </span>
        ))}
      </div>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {ORDER.flatMap((status) => presence.filter((p) => p.status === status)).map((entry) => (
          <Row key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
