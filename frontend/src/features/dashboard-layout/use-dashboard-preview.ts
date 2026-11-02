'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useApiQuery } from '@/hooks/use-api';
import { PARTIAL_SECTIONS } from '@/features/modules/hooks/use-section-access';
import {
  DASHBOARD_MAX_COLS,
  DASHBOARD_MAX_ROWS,
  DASHBOARD_WIDGETS,
  type DashboardLayout,
  type DashboardWidgetSlot,
} from './dashboard-widgets';

const MANAGER_ROLES = ['OWNER', 'ADMIN'];
const WIDGET_IDS = new Set<string>(DASHBOARD_WIDGETS.map((w) => w.id));

export interface DashboardPreview {
  deviceId: string;
  layout: DashboardLayout;
  isLoading: boolean;
  canSee: (sectionKey?: string) => boolean;
  canEnter: (sectionKey?: string) => boolean;
}

/** URL de la vista previa: la pantalla que se está editando, aún sin guardar. */
export function dashboardPreviewUrl(deviceId: string, layout: DashboardLayout): string {
  const params = new URLSearchParams({
    preview: deviceId,
    title: layout.title,
    // `id:ancho:alto` por card, separadas por comas.
    widgets: layout.widgets.map((w) => `${w.id}:${w.cols}:${w.rows}`).join(','),
  });
  return `/dashboard?${params.toString()}`;
}

const clamp = (raw: string | undefined, max: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : 1;
};

/** `id:ancho:alto,…` → slots válidos (ids desconocidos fuera, tamaños fuera de rango → 1). */
function parseWidgets(value: string | null): DashboardWidgetSlot[] {
  return (value ?? '')
    .split(',')
    .map((part) => {
      const [id, cols, rows] = part.split(':');
      return { id, cols: clamp(cols, DASHBOARD_MAX_COLS), rows: clamp(rows, DASHBOARD_MAX_ROWS) };
    })
    .filter((w) => WIDGET_IDS.has(w.id));
}

/**
 * Vista previa de la pantalla de un dispositivo (`/dashboard?preview=…`), solo
 * para OWNER/ADMIN: título y cards salen de la URL (lo marcado en el editor) y
 * los permisos son los del dispositivo, no los del administrador, para ver
 * exactamente las mismas cards que verá él. null fuera de vista previa.
 */
export function useDashboardPreview(): DashboardPreview | null {
  const { user } = useAuth();
  const params = useSearchParams();
  const deviceId = params.get('preview');
  const active = Boolean(deviceId) && MANAGER_ROLES.includes(user?.role ?? '');
  const { data: sections, isLoading } = useApiQuery<Record<string, boolean>>(
    ['dashboard-layout', 'device-sections', deviceId ?? ''],
    `/v1/dashboard-layout/devices/${deviceId}/sections`,
    { enabled: active },
  );
  if (!active) return null;

  const map = sections ?? {};
  const canSee = (key?: string) => !key || (map[key] ?? true);
  const canEnter = (key?: string) =>
    canSee(key) || (!!key && (PARTIAL_SECTIONS[key] ?? []).some((k) => map[k] === true));

  return {
    deviceId: deviceId as string,
    layout: {
      title: params.get('title')?.trim() || 'Vista previa',
      widgets: parseWidgets(params.get('widgets')),
    },
    isLoading,
    canSee,
    canEnter,
  };
}
