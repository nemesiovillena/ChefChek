/** Clases compartidas por los formularios de Check-In (inputs ≥16px: iOS no hace zoom). */
export const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
export const labelCls = 'mb-1 block text-sm font-medium text-[var(--on-surface-variant)]';
export const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';
export const primaryBtnCls =
  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40';
export const secondaryBtnCls =
  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 font-medium disabled:opacity-40';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/**
 * ¿Puede gestionar Check-In (fichas, ajustes, presencia)? Hace falta rol de
 * gestión y cuenta personal: en una cuenta compartida no se muestran datos
 * personales. El servidor aplica la misma regla.
 */
export function canManageCheckIn(user: { role?: string; isSharedAccount?: boolean } | null | undefined): boolean {
  return MANAGE_ROLES.includes(user?.role ?? '') && user?.isSharedAccount !== true;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Inténtalo de nuevo.';
}
