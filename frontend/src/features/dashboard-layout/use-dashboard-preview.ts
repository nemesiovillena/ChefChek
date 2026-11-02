'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useApiQuery } from '@/hooks/use-api';
import { PARTIAL_SECTIONS } from '@/features/modules/hooks/use-section-access';
import { DASHBOARD_WIDGETS, type DashboardLayout } from './dashboard-widgets';

const MANAGER_ROLES = ['OWNER', 'ADMIN'];
const WIDGET_IDS = new Set<string>(DASHBOARD_WIDGETS.map((w) => w.id));

export interface DashboardPreview {
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
    widgets: layout.widgets.join(','),
  });
  return `/dashboard?${params.toString()}`;
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
    layout: {
      title: params.get('title')?.trim() || 'Vista previa',
      widgets: (params.get('widgets') ?? '').split(',').filter((id) => WIDGET_IDS.has(id)),
    },
    isLoading,
    canSee,
    canEnter,
  };
}
