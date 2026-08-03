'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useUsers, useUpdateUser, useDeleteUser, User } from '@/hooks/use-users';
import { Pencil, Trash2, UserRound } from 'lucide-react';
import UserModal from './components/user-modal';
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
  const { user, tenantId, isLoading, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();

  const { data: usersData, isLoading: usersLoading } = useUsers();
  const users: User[] = Array.isArray(usersData?.data) ? usersData.data : [];
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
    try {
      await updateMutation.mutateAsync({ id: targetUser.id, isActive: !targetUser.isActive });
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

  return (
    <div className="w-full">
      <PageContainer>
        <PageHeader
          title="Gestión de usuarios"
          actions={
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Crear usuario
            </button>
          }
        />

        <div className={tableCardClass}>
          <div className={tableScrollClass}>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thBaseClass}>Usuario</th>
                  <th className={thBaseClass}>Email</th>
                  <th className={thBaseClass}>Rol</th>
                  <th className={thBaseClass}>Estado</th>
                  <th className={thBaseClass}>Fecha de creación</th>
                  <th className={thActionsClass}>Acciones</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-[var(--on-surface-variant)]">
                      Cargando...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-[var(--on-surface-variant)]">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  users.map((targetUser) => (
                    <tr key={targetUser.id} className={trHoverClass}>
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
                          <div className="truncate text-sm font-medium text-[var(--on-surface)]" title={targetUser.name}>{targetUser.name}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="truncate text-sm text-[var(--on-surface)]" title={targetUser.email}>{targetUser.email}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {targetUser.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(targetUser)}
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
                            targetUser.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {targetUser.isActive ? 'Activo' : 'Desactivado'}
                        </button>
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
      </PageContainer>

      <UserModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        targetUser={selectedUser}
        currentTenantId={tenantId}
        onSaved={() => {
          if (selectedUser?.id === user?.id) refreshUser();
        }}
      />
    </div>
  );
}
