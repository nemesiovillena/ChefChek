'use client';

import { useState } from 'react';
import { KeyRound, Plus, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useCheckInSettings, useEmployees, useWorkCenters } from '@/hooks/use-check-in';
import type { Employee } from '@/lib/check-in-types';
import { CheckInEmployeeForm } from '../components/check-in-employee-form';
import { CheckInReadinessBanner } from '../components/check-in-readiness-banner';
import { primaryBtnCls } from '../components/check-in-form-styles';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** Fichas laborales de Check-In. Solo para quien gestiona el módulo. */
export default function CheckInEmployeesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(false);
  // 'new' = alta; un id = edición; null = formulario cerrado.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: employees, isLoading } = useEmployees(includeInactive);
  const { data: centers } = useWorkCenters();
  const { data: settingsData } = useCheckInSettings();

  if (authLoading) return null;
  if (!canManage) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  const editingEmployee: Employee | null =
    editing && editing !== 'new' ? (employees?.find((e) => e.id === editing) ?? null) : null;
  const centerName = (id: string | null) => centers?.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-28 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-lg text-headline-lg text-primary">Empleados</h2>
        <button type="button" onClick={() => setEditing('new')} className={primaryBtnCls}>
          <Plus className="h-4 w-4" /> Nuevo empleado
        </button>
      </div>

      <CheckInReadinessBanner />

      {editing && centers && settingsData && (
        <CheckInEmployeeForm
          key={editing}
          employee={editingEmployee}
          centers={centers}
          pinLength={settingsData.settings.pinLength}
          onDone={() => setEditing(null)}
        />
      )}

      <label className="mb-4 flex min-h-[40px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
          className="h-5 w-5"
        />
        Mostrar también las bajas
      </label>

      {isLoading && <p className="text-[var(--on-surface-variant)]">Cargando…</p>}
      {!isLoading && employees?.length === 0 && (
        <p className="text-[var(--on-surface-variant)]">
          Aún no hay empleados. Crea la primera ficha para poder fichar.
        </p>
      )}

      <div className="space-y-2">
        {employees?.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e.id)}
            className={`flex w-full items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-left ${
              e.isActive ? '' : 'opacity-60'
            }`}
          >
            <UserRound className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {e.lastName}, {e.firstName}
                {!e.isActive && ' (baja)'}
              </span>
              <span className="block truncate text-sm text-[var(--on-surface-variant)]">
                {[e.jobTitle, e.section, centerName(e.defaultLocationId), `${e.weeklyHours} h/sem`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="block truncate text-sm text-[var(--on-surface-variant)]">
                {e.user ? `Cuenta: ${e.user.email}` : 'Sin cuenta: solo kiosco'}
              </span>
            </span>
            <span
              className={`flex shrink-0 items-center gap-1 text-xs ${
                e.hasPin ? 'text-[var(--primary)]' : 'text-[var(--on-surface-variant)]'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              {e.hasPin ? 'PIN' : 'Sin PIN'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
