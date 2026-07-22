'use client';

import { useState } from 'react';
import { useSupplierSearch } from '@/hooks/use-supplier-search';
import { useCreateSupplier, type CreateSupplierDto, type UpdateSupplierDto } from '@/hooks/use-supplier-mutations';
import { useNotification } from '@/components/notification-system';
import { updateAlbaran } from '@/lib/api-albaran';
// Reuse the canonical supplier modal used by the Proveedores page so the
// "Nuevo proveedor" experience is identical across the app.
import SupplierModal from '@/app/dashboard/proveedores/components/supplier-modal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Building2, Plus } from 'lucide-react';

interface SupplierPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albaranId: string;
  currentSupplierId?: string;
  onSuccess: () => void;
}

export function SupplierPickerDialog({
  open,
  onOpenChange,
  albaranId,
  currentSupplierId,
  onSuccess,
}: SupplierPickerDialogProps) {
  const { suppliers, loading, search, setSearch, error, refresh } = useSupplierSearch();
  const addNotification = useNotification();
  const createMutation = useCreateSupplier();
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSelectSupplier = async (supplierId: string) => {
    if (supplierId === currentSupplierId) {
      onOpenChange(false);
      return;
    }

    setUpdating(true);
    setUpdateError(null);
    try {
      await updateAlbaran(albaranId, { supplierId });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar proveedor';
      setUpdateError(message);
    } finally {
      setUpdating(false);
    }
  };

  // Create a supplier through the canonical modal, then refresh the picker list
  // (kept in local state, not React Query) and auto-assign it to this albarán.
  const handleCreateSupplier = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      const result = await createMutation.mutateAsync(data as CreateSupplierDto);
      // apiClient's response interceptor unwraps { success, data } → result is the supplier itself.
      const newId = result?.id;
      setCreateOpen(false);
      refresh();
      if (newId) {
        await handleSelectSupplier(newId);
      }
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'No se pudo crear el proveedor',
        message: err instanceof Error ? err.message : 'Error al crear el proveedor',
      });
    }
  };

  return (
    <>
      <Dialog open={open && !createOpen} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar Proveedor</DialogTitle>
            <DialogDescription>
              Selecciona el proveedor correcto para este albarán
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar proveedores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {updateError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {updateError}
            </div>
          )}

          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">{error}</div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {search ? `No se encontraron proveedores para "${search}"` : 'No hay proveedores disponibles'}
              </div>
            ) : (
              <div className="space-y-1">
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    onClick={() => handleSelectSupplier(supplier.id)}
                    disabled={updating}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left disabled:opacity-50 ${
                      supplier.id === currentSupplierId
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{supplier.name}</p>
                      {supplier.id === currentSupplierId && (
                        <span className="text-xs text-indigo-600">Proveedor actual</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Abrir el mismo modal de "Nuevo proveedor" que usa la página Proveedores */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Crear nuevo proveedor
          </button>
        </DialogContent>
      </Dialog>

      {/* Modal canónico (overlay propio, sin Radix) — no choca con el focus trap del Dialog */}
      <SupplierModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        supplier={null}
        onSubmit={handleCreateSupplier}
        isSubmitting={createMutation.isPending}
      />
    </>
  );
}
