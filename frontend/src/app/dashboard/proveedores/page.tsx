'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Truck, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import apiClient from '@/lib/api-client';
import type { ApiError } from '@/types/api.types';
import {
  useSuppliers,
  useSuppliersStats,
  type Supplier,
} from '@/hooks/use-suppliers';
import {
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useToggleSupplierActive,
  type CreateSupplierDto,
  type UpdateSupplierDto,
} from '@/hooks/use-supplier-mutations';
import SupplierModal from './components/supplier-modal';
import { SupplierTable } from './components/supplier-table';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

function resolveSupplierErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export default function ProveedoresPage() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const { data: suppliers, isLoading } = useSuppliers();
  const { data: stats } = useSuppliersStats();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplierActive();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignSupplier, setReassignSupplier] = useState<{ id: string; name: string; productCount: number } | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--on-surface-variant)]">
        Cargando proveedores...
      </div>
    );
  }

  const canManage = MANAGE_ROLES.includes(user?.role ?? '') || user?.role === 'USER';
  const list = suppliers ?? [];

  const handleCreate = () => {
    setEditingSupplier(null);
    setModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setModalOpen(true);
  };

  const handleSubmit = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, data: data as UpdateSupplierDto });
      } else {
        await createMutation.mutateAsync(data as CreateSupplierDto);
      }
      setModalOpen(false);
      setEditingSupplier(null);
      addNotification({
        type: 'success',
        title: editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado',
        message: data.name || editingSupplier?.name || '',
      });
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: resolveSupplierErrorMessage(error, 'Error al guardar proveedor'),
      });
    }
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      await toggleMutation.mutateAsync({ id: supplier.id, isActive: !supplier.isActive });
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Error al cambiar estado',
        message: resolveSupplierErrorMessage(error, 'Error al cambiar estado'),
      });
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    let productCount = 0;
    try {
      const res = await apiClient.get(`/v1/products/suppliers/${supplier.id}/products/count`);
      productCount = res.data?.count || 0;
    } catch {
      // Si falla el conteo, se asume 0 y se deja que el backend bloquee si corresponde.
    }

    if (productCount > 0) {
      setReassignSupplier({ id: supplier.id, name: supplier.name, productCount });
      setReassignTarget('');
      setReassignOpen(true);
      return;
    }

    const ok = await confirm({
      title: `Eliminar el proveedor "${supplier.name}"`,
      description: 'Esta acción no se puede deshacer.',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await deleteMutation.mutateAsync(supplier.id);
      addNotification({ type: 'success', title: 'Proveedor eliminado', message: supplier.name });
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Error al eliminar',
        message: resolveSupplierErrorMessage(error, 'Error al eliminar proveedor'),
      });
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassignSupplier || !reassignTarget) return;
    setIsReassigning(true);
    try {
      await apiClient.put(`/v1/products/suppliers/${reassignSupplier.id}/products/reassign`, {
        targetSupplierId: reassignTarget,
      });
      await deleteMutation.mutateAsync(reassignSupplier.id);
      addNotification({
        type: 'success',
        title: 'Productos reasignados y proveedor eliminado',
        message: `${reassignSupplier.productCount} producto(s) reasignados. "${reassignSupplier.name}" ha sido eliminado.`,
      });
      setReassignOpen(false);
      setReassignSupplier(null);
      setReassignTarget('');
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Error al reasignar',
        message: resolveSupplierErrorMessage(error, 'Error al reasignar productos'),
      });
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* div en vez de <header>: globals.css oculta header:not(.fixed) globalmente */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-[var(--on-surface)]">
            <Truck className="h-7 w-7 text-[var(--primary)]" />
            Proveedores
          </h1>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {stats ? `${stats.count} activos de ${list.length} totales` : `${list.length} proveedores`}
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando proveedores...
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 text-center text-[var(--on-surface-variant)]">
          No hay proveedores. Crea el primero.
        </div>
      ) : (
        <SupplierTable
          suppliers={list}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          isToggling={toggleMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={editingSupplier}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <Sheet open={reassignOpen} onOpenChange={setReassignOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Reasignar productos</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <p className="text-sm text-[var(--on-surface-variant)]">
              &quot;{reassignSupplier?.name}&quot; tiene {reassignSupplier?.productCount} producto(s) asociados.
              Selecciona un proveedor destino para reasignarlos antes de eliminar.
            </p>
            <select
              value={reassignTarget}
              onChange={(e) => setReassignTarget(e.target.value)}
              disabled={isReassigning}
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            >
              <option value="">Seleccionar proveedor...</option>
              {list
                .filter((s) => s.id !== reassignSupplier?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isActive ? '' : ' (Inactivo)'}
                  </option>
                ))}
            </select>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)} disabled={isReassigning}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmReassign} disabled={!reassignTarget || isReassigning}>
              {isReassigning ? 'Reasignando...' : 'Reasignar y eliminar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
