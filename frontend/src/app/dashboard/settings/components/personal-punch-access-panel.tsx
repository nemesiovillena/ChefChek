'use client';

import { Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useEmployees, useUpdateEmployee } from '@/hooks/use-check-in';
import type { Employee } from '@/lib/check-in-types';
import { canManageCheckIn } from '@/app/dashboard/check-in/components/check-in-form-styles';

// Gerencia no ficha: no sale en la lista.
const MANAGER_ROLES = new Set(['ADMIN', 'OWNER', 'SUPERADMIN']);

/**
 * Quién puede fichar desde su propia cuenta (móvil o web). Quien no tenga
 * permiso solo ficha en el kiosco del local. Solo aparecen fichas activas con
 * cuenta de Equipo: las que no tienen cuenta ya solo pueden fichar en kiosco.
 */
export function PersonalPunchAccessPanel() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  if (!isEnabled('check-in') || !canManageCheckIn(user)) return null;
  return <PersonalPunchAccessList />;
}

function PersonalPunchAccessList() {
  const notify = useNotification();
  const { data, isLoading } = useEmployees(false);
  const update = useUpdateEmployee();

  const people = (data ?? []).filter(
    (e) => e.user && !MANAGER_ROLES.has(e.user.role ?? ''),
  );

  async function toggle(employee: Employee) {
    try {
      await update.mutateAsync({
        id: employee.id,
        data: { allowPersonalPunch: !employee.allowPersonalPunch },
      });
    } catch (e) {
      notify({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Inténtalo de nuevo.',
      });
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Smartphone className="h-5 w-5 text-[var(--primary)]" />
        Fichar desde su cuenta
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Marca quién puede fichar desde su móvil u ordenador al entrar con su contraseña. Quien no
        esté marcado solo podrá fichar en la pantalla del local (kiosco).
      </p>

      {isLoading ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">Cargando…</div>
      ) : people.length === 0 ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">
          No hay empleados con cuenta de acceso.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
          {people.map((employee) => (
            <li key={employee.id}>
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[var(--on-surface)]">
                    {`${employee.firstName} ${employee.lastName}`.trim()}
                  </span>
                  {employee.jobTitle && (
                    <span className="block truncate text-xs text-[var(--on-surface-variant)]">
                      {employee.jobTitle}
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary)] [color-scheme:light_dark] disabled:opacity-40"
                  checked={employee.allowPersonalPunch}
                  disabled={update.isPending}
                  onChange={() => toggle(employee)}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
