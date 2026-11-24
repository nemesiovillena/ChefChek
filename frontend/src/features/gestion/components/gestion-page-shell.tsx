'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { GestionSubnav } from './gestion-subnav';
import { ChartLine } from 'lucide-react';

/** Gerencia y oficina: el servidor exige lo mismo (ver gestion.controller.ts). */
const GESTION_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN', 'GESTION'];

/** Marco común de las pantallas de Gestión: título, aviso de fechas y pestañas. */
export function GestionPageShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!GESTION_ROLES.includes(user?.role ?? '')) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-[var(--on-surface-variant)]">
        Gestión es solo para gerencia y oficina.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <div className="flex items-center gap-3 text-2xl font-semibold text-[var(--on-surface)]">
          <ChartLine aria-hidden className="h-6 w-6 text-[var(--primary)]" />
          Gestión
        </div>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Ventas del TPV (Cuiner). Las fechas son días de caja: lo cobrado después de medianoche cuenta en el día de la caja.
        </p>
      </div>
      <GestionSubnav />
      {children}
    </div>
  );
}
