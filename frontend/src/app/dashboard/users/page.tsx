'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useUsers, useUpdateUser, useDeleteUser, User } from '@/hooks/use-users';
import { Pencil, Trash2, UserRound } from 'lucide-react';
import UserModal from './components/user-modal';
import { TeamPositionsTab } from './components/team-positions-tab';
import { CheckInEmployeesWithoutAccount } from './components/check-in-employees-without-account';
import { useEmployees, usePresence } from '@/hooks/use-check-in';
import { useQueryClient } from '@tanstack/react-query';
import { UserActiveSwitch } from './components/user-active-switch';
import { formatWeeklyHours } from '@/lib/check-in-punch';
import { useModules } from '@/features/modules/hooks/use-modules';
import { canManageCheckIn } from '@/app/dashboard/check-in/components/check-in-form-styles';
import { useSetUserPosition, useTeamPositions } from '@/hooks/use-team-positions';
import PageContainer from '@/components/shared/page-container';
import PageHeader from '@/components/shared/page-header';
import {
  tableCardClass, tableScrollClass, tableClass, theadClass, thBaseClass, thActionsClass,
  tbodyClass, trHoverClass, tdBaseClass, tdActionsClass,
} from '@/components/shared/data-table-classes';

export const dynamic = 'force-dynamic';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/** Desplegable del puesto de una persona (cambia al momento). */
function UserPositionSelect({ userId }: { userId: string }) {
  const addNotification = useNotification();
  const positions = useTeamPositions();
  const setPosition = useSetUserPosition();
  const current = positions.data?.find((p) => p.users.some((u) => u.id === userId))?.id ?? '';
  return (
    <select
      aria-label="Puesto"
      value={current}
      disabled={positions.isLoading || setPosition.isPending}
      onChange={async (e) => {
        try {
          await setPosition.mutateAsync({ userId, positionId: e.target.value || null });
        } catch (error: unknown) {
          addNotification({ type: 'error', title: 'No se pudo cambiar el puesto', message: error instanceof Error ? error.message : '' });
        }
      }}
      className="min-h-[36px] max-w-[160px] rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 text-sm text-[var(--on-surface)]"
    >
      <option value="">Sin puesto</option>
      {positions.data?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}

/** Horas de contrato de la ficha de Fichar (solo se monta con Fichar activo). */
function CheckInHoursCell({ userId }: { userId: string }) {
  const { data: employees } = useEmployees(true);
  const employee = employees?.find((e) => e.userId === userId);
  if (!employees) return null;
  return (
    <span className="text-sm text-[var(--on-surface-variant)]">
      {employee ? formatWeeklyHours(employee.weeklyHours, ' h/sem') : 'Sin ficha'}
    </span>
  );
}

/** Tarjeta de contexto para el diálogo de borrado: ancla la confirmación al usuario real. */
function UserContextCard({ targetUser }: { targetUser: User }) {
  const meta = [targetUser.role, targetUser.email].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-container-highest)] text-sm font-medium text-[var(--on-surface-variant)]">
        {targetUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={targetUser.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          getInitials(targetUser.name) || <UserRound className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--on-surface)]">{targetUser.name}</p>
        {meta && <p className="truncate text-xs text-[var(--on-surface-variant)]">{meta}</p>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  // Datos personales: solo responsables desde su cuenta personal. El
  // contenido (y sus peticiones) solo se monta para ellos.
  if (!canManageCheckIn(user)) {
    return (
      <PageContainer>
        <p className="pt-8 text-[var(--on-surface-variant)]">
          Empleados es solo para responsables, desde su cuenta personal.
        </p>
      </PageContainer>
    );
  }
  return <EmployeesContent />;
}

function EmployeesContent() {
  const { user, tenantId, isLoading, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();

  const { data: usersData, isLoading: usersLoading } = useUsers();
  const allUsers: User[] = Array.isArray(usersData?.data) ? usersData.data : [];
  const users = allUsers;
  // Las cuentas compartidas (dispositivos) no son personas: van en su propia tabla.
  // Los desactivados siguen en la lista, al final y atenuados.
  const people = users
    .filter((u) => !u.isSharedAccount)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  const devices = users.filter((u) => u.isSharedAccount);
  const positions = useTeamPositions();
  const withPosition = new Set(positions.data?.flatMap((p) => p.users.map((u) => u.id)) ?? []);
  const withoutPosition = positions.data ? users.filter((u) => u.isActive && !withPosition.has(u.id)) : [];
  const { isEnabled } = useModules();
  const checkInOn = isEnabled('check-in');
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();
  // Para avisar si alguien sigue fichado dentro cuando se le desactiva.
  const presence = usePresence(checkInOn);
  const deleteMutation = useDeleteUser();

  const [showModal, setShowModal] = useState(false);
  // Pestañas de Equipo: personas o puestos (y qué ve cada puesto).
  const [view, setView] = useState<'personas' | 'puestos'>('personas');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // Enlace directo a la ficha de una persona (p. ej. desde Fichar → Empleados):
  // ?usuario=<id>&pestana=laboral abre su ficha en esa pestaña.
  const searchParams = useSearchParams();
  const linkedUserId = searchParams.get('usuario');
  const linkedTab = searchParams.get('pestana') === 'laboral' ? 'laboral' : 'datos';
  const linkedUser = !showModal && linkedUserId ? (users.find((u) => u.id === linkedUserId) ?? null) : null;
  const modalUser = showModal ? selectedUser : linkedUser;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  const handleCreate = () => {
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEdit = (targetUser: User) => {
    setSelectedUser(targetUser);
    setShowModal(true);
  };

  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === user?.id) {
      addNotification({ type: 'warning', title: 'Acción no permitida', message: 'No puedes desactivar tu propio usuario.' });
      return;
    }
    if (targetUser.isActive) {
      const working = presence.data?.find((p) => p.userId === targetUser.id && p.status !== 'OUT');
      const ok = await confirm({
        title: `Desactivar a ${targetUser.name}`,
        description: targetUser.isSharedAccount
          ? 'El dispositivo no podrá entrar en la app hasta que lo vuelvas a activar.'
          : 'No podrá entrar en la app ni fichar, y deja de aparecer en el kiosco, Turnos y los listados. Se guarda hoy como fecha de baja. Sus fichajes y su puesto se conservan para cuando lo reactives.',
        confirmText: 'Desactivar',
        variant: 'destructive',
        children: working ? (
          <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            Está fichado dentro
            {working.since
              ? ` desde las ${new Date(working.since).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
            . Al desactivarlo ya no podrá fichar la salida: corrígela después en Fichar → Hojas de horas.
          </p>
        ) : undefined,
      });
      if (!ok) return;
    }
    try {
      await updateMutation.mutateAsync({ id: targetUser.id, isActive: !targetUser.isActive });
      // Kiosco, presencia, fichas y puestos dependen del estado de la cuenta.
      queryClient.invalidateQueries({ queryKey: ['check-in'] });
      queryClient.invalidateQueries({ queryKey: ['team-positions'] });
      addNotification({
        type: 'success',
        title: 'Estado actualizado',
        message: `El usuario "${targetUser.name}" ha sido ${!targetUser.isActive ? 'activado' : 'desactivado'}`,
      });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al cambiar el estado del usuario' });
    }
  };

  const handleDelete = async (targetUser: User) => {
    if (targetUser.id === user?.id) {
      addNotification({ type: 'warning', title: 'Acción no permitida', message: 'No puedes eliminar tu propio usuario.' });
      return;
    }
    const ok = await confirm({
      title: 'Eliminar usuario',
      description: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
      children: <UserContextCard targetUser={targetUser} />,
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(targetUser.id);
      addNotification({ type: 'success', title: 'Usuario eliminado', message: `"${targetUser.name}" se ha eliminado correctamente.` });
    } catch (error: unknown) {
      addNotification({ type: 'error', title: 'No se pudo eliminar', message: error instanceof Error ? error.message : 'Error al eliminar el usuario' });
    }
  };

  // Tabla de cuentas: personas (con su contrato de Fichar) o dispositivos compartidos.
  const renderTable = (rows: User[], showContract: boolean, emptyText: string) => {
    const colSpan = showContract ? 8 : 7;
    return (
      <div className={tableCardClass}>
        <div className={tableScrollClass}>
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className={thBaseClass}>Usuario</th>
                <th className={thBaseClass}>Email</th>
                <th className={thBaseClass}>Rol</th>
                <th className={thBaseClass}>Puesto</th>
                {showContract && <th className={thBaseClass}>Contrato</th>}
                <th className={thBaseClass}>Estado</th>
                <th className={thBaseClass}>Fecha de creación</th>
                <th className={thActionsClass}>Acciones</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {usersLoading || rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-6 py-4 text-center text-[var(--on-surface-variant)]">
                    {usersLoading ? 'Cargando...' : emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((targetUser) => (
              <tr key={targetUser.id} className={`${trHoverClass} ${targetUser.isActive ? '' : 'opacity-60'}`}>
                <td className="px-3 py-3 max-w-[220px]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-container-high)] text-xs font-medium text-[var(--on-surface-variant)]">
                      {targetUser.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={targetUser.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(targetUser.name) || <UserRound className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--on-surface)]" title={targetUser.name}>{targetUser.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 max-w-[220px]">
                  <div className="truncate text-sm text-[var(--on-surface)]" title={targetUser.email}>{targetUser.email}</div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {targetUser.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <UserPositionSelect userId={targetUser.id} />
                </td>
                {showContract && (
                  <td className="px-3 py-3 whitespace-nowrap">
                    <CheckInHoursCell userId={targetUser.id} />
                  </td>
                )}
                <td className="px-3 py-3 whitespace-nowrap">
                  <UserActiveSwitch
                    name={targetUser.name}
                    active={targetUser.isActive}
                    // El propio usuario se ve normal; al pulsarlo, handleToggleStatus avisa
                    // de que no puede desactivarse a sí mismo.
                    disabled={updateMutation.isPending}
                    onToggle={() => handleToggleStatus(targetUser)}
                  />
                </td>
                <td className={tdBaseClass}>
                  {new Date(targetUser.createdAt).toLocaleDateString()}
                </td>
                <td className={tdActionsClass}>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleEdit(targetUser)}
                      className="text-[var(--on-surface-variant)] hover:text-indigo-600 transition-colors"
                      title="Editar usuario"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(targetUser)}
                      className="text-[var(--on-surface-variant)] hover:text-red-600 transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <PageContainer>
        <PageHeader
          title="Empleados"
          actions={
            view === 'personas' ? (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Nueva persona
              </button>
            ) : undefined
          }
        />

        {/* role="tablist" en un <div>: globals.css oculta los <nav> no fijos. */}
        <div role="tablist" aria-label="Empleados" className="mb-4 flex gap-2">
          {(['personas', 'puestos'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-medium ${
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)]'
              }`}
            >
              {v === 'personas' ? 'Personas' : 'Puestos'}
            </button>
          ))}
        </div>

        {view === 'puestos' && <TeamPositionsTab />}

        {view === 'personas' && withoutPosition.length > 0 && (
          <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>{withoutPosition.length === 1 ? '1 persona sin puesto' : `${withoutPosition.length} personas sin puesto`}:</strong>{' '}
            {withoutPosition.map((u) => u.name).join(', ')}. Todas necesitan uno (también las cuentas compartidas). Si no
            encaja ninguno, créalo en Puestos (p. ej. Administración).
          </div>
        )}

        {view === 'personas' && renderTable(people, checkInOn, 'No se encontraron personas')}
        {view === 'personas' && !usersLoading && devices.length > 0 && (
          <section className="mt-8 space-y-3">
            <div>
              <h3 className="font-semibold text-[var(--on-surface)]">Dispositivos compartidos</h3>
              <p className="text-sm text-[var(--on-surface-variant)]">
                Cuentas para las tablets u ordenadores que usa todo el equipo; no son personas. Al iniciar sesión con una de ellas en la tablet, la app pide quién hace cada tarea y Fichar abre el kiosco.
              </p>
            </div>
            {renderTable(devices, false, '')}
          </section>
        )}
        {view === 'personas' && checkInOn && !usersLoading && (
          <CheckInEmployeesWithoutAccount accountIds={new Set(allUsers.map((u) => u.id))} />
        )}
      </PageContainer>

      <UserModal
        isOpen={showModal || !!linkedUser}
        onClose={() => {
          setShowModal(false);
          if (linkedUserId) router.replace('/dashboard/users');
        }}
        targetUser={modalUser}
        currentTenantId={tenantId}
        initialTab={linkedUser ? linkedTab : undefined}
        onSaved={() => {
          if (modalUser?.id === user?.id) refreshUser();
        }}
      />
    </div>
  );
}
