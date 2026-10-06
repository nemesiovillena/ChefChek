'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Copy, KeyRound, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  useCuinerExports,
  useRegenerateCuinerToken,
  useUpdateCuinerConfig,
} from '@/hooks/use-cuiner';
import {
  CUINER_EXPORT_STATUS_LABELS,
  type CuinerMode,
  type CuinerStatus,
  type UpdateCuinerConfigInput,
} from '@/lib/cuiner-types';
import { inputCls } from './cuiner-link-cell';

const CENTROS = [
  { value: '02', label: '02 · Warynessy' },
  { value: '01', label: '01 · Rodeo Diner' },
];

function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/** Estado del conector, ajustes por local y token del servicio de Windows. */
export function CuinerConfigTab({ status }: { status: CuinerStatus }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const update = useUpdateCuinerConfig();
  const regenerate = useRegenerateCuinerToken();
  const [token, setToken] = useState<string | null>(null);
  const config = status.config;
  const warehouses = useQuery<{ id: string; name: string }[], Error>({
    queryKey: ['cuiner', 'warehouses'],
    queryFn: async () => (await apiClient.get('/v1/almacenes')).data,
  });

  const [draft, setDraft] = useState<UpdateCuinerConfigInput>(() => ({
    enabled: config?.enabled ?? false,
    mode: config?.mode ?? 'DRY_RUN',
    centro: config?.centro ?? '02',
    actUsuario: config?.actUsuario ?? '',
    warehouseId: config?.warehouseId ?? '',
  }));

  async function save() {
    const payload: UpdateCuinerConfigInput = {
      ...draft,
      actUsuario: draft.actUsuario?.trim() || null,
      warehouseId: draft.warehouseId || null,
    };
    if (payload.mode === 'LIVE' && config?.mode !== 'LIVE') {
      const ok = await confirm({
        title: 'Activar el modo real',
        description:
          'A partir de ahora, los albaranes que envíes con «Enviar a Cuiner» se escribirán de verdad en el programa de gestión de Cuiner. ¿Continuar?',
        confirmText: 'Activar modo real',
        variant: 'warning',
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync(payload);
      notify({ type: 'success', title: 'Configuración de Cuiner guardada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo guardar', message: err instanceof Error ? err.message : '' });
    }
  }

  async function generateToken() {
    const ok = await confirm({
      title: config?.hasConnectorToken ? 'Generar un token nuevo' : 'Generar token del conector',
      description: config?.hasConnectorToken
        ? 'El token actual dejará de funcionar y habrá que copiar el nuevo en el servidor de Cuiner.'
        : 'El token solo se mostrará una vez: cópialo en el servidor de Cuiner.',
      confirmText: 'Generar',
      variant: 'info',
    });
    if (!ok) return;
    try {
      setToken((await regenerate.mutateAsync()).token);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo generar el token', message: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <h3 className="font-semibold">Conector</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Última conexión</dt>
          <dd>{formatDateTime(config?.lastSeenAt ?? null)}</dd>
          <dt className="text-gray-500">Catálogo sincronizado</dt>
          <dd>
            {status.catalog.suppliers} proveedores · {status.catalog.articles} artículos · {status.catalog.dishes} platos
          </dd>
          <dt className="text-gray-500">Ventas recibidas</dt>
          <dd>
            {status.sales.PENDIENTE ?? 0} pendientes · {status.sales.APLICADA ?? 0} aplicadas ·{' '}
            {status.sales.SIN_MAPEO ?? 0} sin enlazar
          </dd>
        </dl>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          Conector activo (si lo desactivas, se detiene al instante)
        </label>
        <label className="block text-sm">
          Modo
          <select className={inputCls} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as CuinerMode })}>
            <option value="DRY_RUN">Simulación: valida pero no escribe en Cuiner</option>
            <option value="LIVE">Real: escribe los albaranes en Cuiner</option>
          </select>
        </label>
        {draft.mode === 'LIVE' && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            En modo real los albaranes enviados se escriben en Cuiner. Revisa antes varios envíos en simulación.
          </p>
        )}
        <label className="block text-sm">
          Local en Cuiner (centro)
          <select className={inputCls} value={draft.centro} onChange={(e) => setDraft({ ...draft, centro: e.target.value })}>
            {CENTROS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Usuario de Cuiner que firma los albaranes (código numérico)
          <input
            className={inputCls}
            inputMode="numeric"
            value={draft.actUsuario ?? ''}
            onChange={(e) => setDraft({ ...draft, actUsuario: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Almacén de ChefChek donde descuentan las ventas
          <select className={inputCls} value={draft.warehouseId ?? ''} onChange={(e) => setDraft({ ...draft, warehouseId: e.target.value })}>
            <option value="">Sin elegir</option>
            {(warehouses.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={update.isPending} className="min-h-[44px]">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
          <Button type="button" variant="outline" onClick={generateToken} disabled={!config || regenerate.isPending} className="min-h-[44px]">
            <KeyRound className="h-4 w-4" /> {config?.hasConnectorToken ? 'Regenerar token' : 'Generar token'}
          </Button>
        </div>
        {token && (
          <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950">
            <p>Copia este token en el servidor de Cuiner. No se volverá a mostrar.</p>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded bg-white p-2 font-mono text-xs dark:bg-zinc-900">{token}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(token)} aria-label="Copiar token">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <CuinerExportsList />
    </div>
  );
}

function CuinerExportsList() {
  const { data, isLoading } = useCuinerExports();
  return (
    <section>
      <h3 className="mb-3 font-semibold">Últimos envíos de albaranes</h3>
      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      <ul className="divide-y divide-gray-200 text-sm dark:divide-zinc-800">
        {(data ?? []).slice(0, 30).map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={`/dashboard/albaranes/${e.albaranId}/resumen`} className="text-indigo-600 hover:underline">
              {e.payload?.numdoc || 'Sin número'} · {e.payload?.total?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </Link>
            <span className={e.status === 'ERROR' ? 'text-red-600' : e.status === 'ENVIADO' ? 'text-emerald-700' : 'text-gray-600'}>
              {CUINER_EXPORT_STATUS_LABELS[e.status]}
              {e.cuinerIdDocsCab ? ` · doc ${e.cuinerIdDocsCab}` : ''}
            </span>
            {e.error && <p className="w-full text-xs text-red-600">{e.error}</p>}
          </li>
        ))}
        {data?.length === 0 && <li className="py-4 text-gray-500">Todavía no se ha enviado ningún albarán.</li>}
      </ul>
    </section>
  );
}
