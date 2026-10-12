'use client';

import { Loader2, Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCheckInSettings, useEmployees, useImportEmployees, useWorkCenters } from '@/hooks/use-check-in';
import { CheckInEmployeeForm } from '@/app/dashboard/check-in/components/check-in-employee-form';
import { errorMessage, primaryBtnCls } from '@/app/dashboard/check-in/components/check-in-form-styles';

/**
 * Datos laborales de una persona del equipo: su ficha de Fichar, editada sin
 * salir de Equipo. Las cuentas anteriores a Fichar pueden no tener ficha
 * todavía; se crea aquí con un clic.
 */
export function UserLaborDataTab({ userId }: { userId: string }) {
  const notify = useNotification();
  const { data: employees, isLoading } = useEmployees(true);
  const { data: centers } = useWorkCenters();
  const { data: settingsData } = useCheckInSettings();
  const importEmployees = useImportEmployees();

  if (isLoading || !employees || !centers || !settingsData) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>;
  }

  const employee = employees.find((e) => e.userId === userId) ?? null;
  if (!employee) {
    const createSheet = async () => {
      try {
        await importEmployees.mutateAsync([userId]);
      } catch (err) {
        notify({ type: 'error', title: 'Error', message: errorMessage(err) });
      }
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Esta persona todavía no tiene ficha para fichar.
        </p>
        <button type="button" onClick={createSheet} disabled={importEmployees.isPending} className={primaryBtnCls}>
          {importEmployees.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear ficha de Fichar
        </button>
      </div>
    );
  }

  return (
    <CheckInEmployeeForm
      key={employee.id}
      employee={employee}
      centers={centers}
      pinLength={settingsData.settings.pinLength}
      onDone={() => undefined}
      embedded
    />
  );
}
