'use client';

import { Loader2 } from 'lucide-react';
import { useMailAccessLog } from '../hooks/use-correo';

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/** Pestaña «Accesos» (solo gerencia): quién abrió o envió qué y cuándo. */
export function MailAccessLogTable() {
  const log = useMailAccessLog(true);
  const entries = log.data?.pages.flatMap((p) => p.entries) ?? [];

  if (log.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[var(--on-surface-variant)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando accesos…
      </div>
    );
  }
  if (log.error) return <p className="p-6 text-sm text-[var(--error)]">{log.error.message}</p>;
  if (entries.length === 0) return <p className="p-6 text-sm text-[var(--on-surface-variant)]">Todavía no hay accesos.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-[var(--surface-container)] text-left text-[var(--on-surface-variant)]">
          <tr>
            <th className="px-3 py-2 font-medium">Persona</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Qué hizo</th>
            <th className="px-3 py-2 font-medium">Carpeta</th>
            <th className="px-3 py-2 font-medium">Asunto</th>
            <th className="px-3 py-2 font-medium">Remitente / destinatario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--outline-variant)]">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2">{e.userName}</td>
              <td className="whitespace-nowrap px-3 py-2">{dateTime(e.createdAt)}</td>
              <td className="px-3 py-2">{e.kind === 'send' ? 'Envió' : e.part ? 'Descargó adjunto' : 'Abrió'}</td>
              <td className="px-3 py-2">{e.folder}</td>
              <td className="max-w-[16rem] truncate px-3 py-2" title={e.subject ?? ''}>{e.subject ?? '—'}</td>
              <td className="max-w-[14rem] truncate px-3 py-2">{e.kind === 'send' ? `Para: ${e.to ?? '—'}` : (e.from ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {log.hasNextPage && (
        <button
          type="button"
          onClick={() => log.fetchNextPage()}
          disabled={log.isFetchingNextPage}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-medium text-[var(--primary)]"
        >
          {log.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
          Cargar más
        </button>
      )}
    </div>
  );
}
