'use client';

import { useState } from 'react';
import { KeyRound, UserRound, UsersRound } from 'lucide-react';
import { useCheckInSettings, useEmployees, useLinkableUsers, useWorkCenters } from '@/hooks/use-check-in';
import type { Employee } from '@/lib/check-in-types';
import { CheckInEmployeeForm } from '@/app/dashboard/check-in/components/check-in-employee-form';
import { CheckInEmployeeImport } from '@/app/dashboard/check-in/components/check-in-employee-import';
import { secondaryBtnCls } from '@/app/dashboard/check-in/components/check-in-form-styles';

const rowCls =
  'flex w-full items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-left';

/**
 * Fichas de Fichar que no cuelgan de ninguna persona de la lista: las antiguas
 * sin cuenta (solo kiosco con PIN) y las de cuentas ya eliminadas (bajas, que
 * se conservan 4 años). Las nuevas fichas nacen siempre de una cuenta.
 * Solo se monta con Fichar activo y para responsables.
 */
export function CheckInEmployeesWithoutAccount({ accountIds }: { accountIds: Set<string> }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const { data: employees } = useEmployees(includeInactive);
  const { data: centers } = useWorkCenters();
  const { data: settingsData } = useCheckInSettings();
  const { data: linkableUsers } = useLinkableUsers();

  const orphans = (employees ?? []).filter((e) => !e.userId || !accountIds.has(e.userId));
  const editingEmployee: Employee | null = orphans.find((e) => e.id === editing) ?? null;
  const pendingImports = linkableUsers?.length ?? 0;
  if (orphans.length === 0 && pendingImports === 0 && !includeInactive) return null;

  return (
    <section className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--on-surface)]">Fichas de Fichar sin persona en la lista</h3>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Fichas antiguas sin cuenta (solo kiosco) y fichas de cuentas eliminadas. Las nuevas se crean al dar de alta
            a la persona.
          </p>
        </div>
        {pendingImports > 0 && (
          <button type="button" onClick={() => setImporting(true)} className={secondaryBtnCls}>
            <UsersRound className="h-4 w-4" /> Crear fichas de cuentas sin ficha ({pendingImports})
          </button>
        )}
      </div>

      {importing && linkableUsers && (
        <CheckInEmployeeImport users={linkableUsers} onDone={() => setImporting(false)} />
      )}

      {editingEmployee && centers && settingsData && (
        <CheckInEmployeeForm
          key={editingEmployee.id}
          employee={editingEmployee}
          centers={centers}
          pinLength={settingsData.settings.pinLength}
          onDone={() => setEditing(null)}
        />
      )}

      <label className="flex min-h-[40px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
          className="h-5 w-5"
        />
        Mostrar también las bajas
      </label>

      <div className="space-y-2">
        {orphans.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e.id)}
            className={`${rowCls} ${e.isActive ? '' : 'opacity-60'}`}
          >
            <UserRound className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {[e.lastName, e.firstName].filter(Boolean).join(', ')}
                {!e.isActive && ' (baja)'}
              </span>
              <span className="block truncate text-sm text-[var(--on-surface-variant)]">
                {[e.userId ? 'Cuenta eliminada' : 'Sin cuenta: solo kiosco', `${e.weeklyHours} h/sem`].join(' · ')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--on-surface-variant)]">
              <KeyRound className="h-4 w-4" />
              {e.hasPin ? 'PIN' : 'Sin PIN'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
