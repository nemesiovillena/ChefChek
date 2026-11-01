import type { MailAddress } from '../hooks/use-correo';

/** Utilidades de presentación compartidas por la bandeja. */
export const senderLabel = (list: MailAddress[]) =>
  list.map((a) => a.name || a.address).filter(Boolean).join(', ') || '(sin remitente)';

export const fullAddresses = (list: MailAddress[]) =>
  list.map((a) => (a.name && a.address ? `${a.name} <${a.address}>` : a.address || a.name)).filter(Boolean).join(', ');

export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat('es-ES', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }).format(d);
}

export function longDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
