'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCuinerAlbaranExport, useSendAlbaranToCuiner } from '@/hooks/use-cuiner';
import { CUINER_EXPORT_STATUS_LABELS } from '@/lib/cuiner-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN', 'USER_CUINER'];
const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/** Antigüedad (días) a partir de la cual se avisa de revisar la fecha. */
const OLD_DATE_WARNING_DAYS = 30;

/** Fecha del payload (AAAA-MM-DD) en formato español. */
const fechaEs = (fecha: string) => fecha.split('-').reverse().join('/');

/**
 * Aviso (no bloqueante) si la fecha del albarán está lejos de hoy: el OCR a
 * veces lee mal el año escrito a mano (2026 → 2020) y Cuiner la grabaría así.
 */
function dateWarning(fecha: string): string | null {
  const [y, m, d] = fecha.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  if (days < -1) {
    return `La fecha del albarán (${fechaEs(fecha)}) es futura: compruébala con el papel antes de enviarlo.`;
  }
  if (days > OLD_DATE_WARNING_DAYS) {
    return `La fecha del albarán es ${fechaEs(fecha)}, hace ${days} días: compruébala con el papel antes de enviarlo (el OCR a veces lee mal el año escrito a mano).`;
  }
  return null;
}

/**
 * Tarjeta «Cuiner» del resumen del albarán: muestra qué falta enlazar y, si
 * está todo, envía el albarán confirmado al conector con el botón (nunca de
 * forma automática). Oculta si el módulo no está activo o el usuario no es
 * administrador ni User Cuiner.
 */
export function CuinerSendCard({ albaranId, confirmed }: { albaranId: string; confirmed: boolean }) {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const visible = isEnabled('cuiner') && !!user && MANAGE_ROLES.includes(user.role);
  const { data, isLoading, error } = useCuinerAlbaranExport(albaranId, visible && confirmed);
  const send = useSendAlbaranToCuiner(albaranId);
  const confirm = useConfirm();
  const notify = useNotification();

  if (!visible || !confirmed) return null;

  const existing = data?.export ?? null;
  const preview = data?.preview;
  const alreadySent = existing?.status === 'ENVIADO';
  const queued = existing?.status === 'PENDIENTE';
  const fechaWarning = preview?.payload ? dateWarning(preview.payload.fecha) : null;

  async function handleSend() {
    if (!preview?.payload) return;
    const ok = await confirm({
      title: 'Enviar albarán a Cuiner',
      description: `Se enviarán ${preview.payload.lineas.length} líneas por ${eur(preview.payload.total)} al proveedor ${preview.payload.codigo} de Cuiner, con fecha ${fechaEs(preview.payload.fecha)}.${fechaWarning ? ` ⚠️ ${fechaWarning}` : ''}`,
      confirmText: 'Enviar',
      variant: fechaWarning ? 'warning' : 'info',
    });
    if (!ok) return;
    try {
      await send.mutateAsync();
      notify({ type: 'success', title: 'Albarán en cola', message: 'El conector lo procesará en su próxima ejecución.' });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo enviar', message: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cuiner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        {error && <p className="text-red-600">{error.message}</p>}

        {existing && (
          <p className={existing.status === 'ERROR' ? 'text-red-600' : alreadySent ? 'text-emerald-700' : 'text-gray-700 dark:text-zinc-300'}>
            {CUINER_EXPORT_STATUS_LABELS[existing.status]}
            {existing.cuinerIdDocsCab ? ` (documento ${existing.cuinerIdDocsCab})` : ''}
            {existing.error ? `: ${existing.error}` : ''}
          </p>
        )}

        {preview && preview.problems.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Falta para poder enviarlo:</p>
            <ul className="space-y-1">
              {preview.problems.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {p}
                </li>
              ))}
            </ul>
            {preview.problems.some((p) => p.includes('enlazad')) && (
              <Link href="/dashboard/cuiner" className="mt-2 inline-block text-indigo-600 hover:underline">
                Ir a los enlaces de Cuiner
              </Link>
            )}
          </div>
        )}

        {preview?.payload && !alreadySent && (
          <>
            <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Listo: {preview.payload.lineas.length} líneas ·{' '}
              {eur(preview.payload.total)} · {fechaEs(preview.payload.fecha)}
            </p>
            {fechaWarning && (
              <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {fechaWarning}
              </p>
            )}
            <Button className="w-full" onClick={handleSend} disabled={send.isPending || queued}>
              {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {queued ? 'En cola del conector' : existing ? 'Reenviar a Cuiner' : 'Enviar a Cuiner'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
