'use client';

import { useState } from 'react';
import { Loader2, UsersRound } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useImportEmployees } from '@/hooks/use-check-in';
import type { LinkableUser } from '@/lib/check-in-types';
import { cardCls, errorMessage, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

/**
 * Crea fichas de empleado a partir de las cuentas del equipo que aún no la
 * tienen, para no volver a teclear lo que ya está en Equipo y en SICTED.
 */
export function CheckInEmployeeImport({ users, onDone }: { users: LinkableUser[]; onDone: () => void }) {
  const notify = useNotification();
  const importEmployees = useImportEmployees();
  const [selected, setSelected] = useState<string[]>(() => users.map((u) => u.id));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function handleImport() {
    try {
      const created = await importEmployees.mutateAsync(selected);
      notify({
        type: 'success',
        title: `${created.length} ficha${created.length === 1 ? '' : 's'} creada${created.length === 1 ? '' : 's'}`,
        message: 'Completa en cada una el DNI, la Seguridad Social y el contrato.',
      });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} mb-6 space-y-3`}>
      <div>
        <h3 className="font-semibold">Importar del equipo</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Se crea una ficha por cada cuenta marcada, con su nombre y, si lo tiene, su puesto de SICTED. Quedan vinculadas
          a su cuenta para fichar sin PIN. Los datos laborales (DNI, Seguridad Social, contrato) se completan después.
        </p>
      </div>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {users.map((user) => (
          <li key={user.id}>
            <label className="flex min-h-[48px] items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={() => toggle(user.id)}
                className="h-5 w-5 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{user.name}</span>
                <span className="block truncate text-sm text-[var(--on-surface-variant)]">
                  {[user.suggestedJobTitle, user.email].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={importEmployees.isPending || selected.length === 0}
          className={`${primaryBtnCls} flex-1`}
        >
          {importEmployees.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}
          Crear {selected.length} ficha{selected.length === 1 ? '' : 's'}
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
