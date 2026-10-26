'use client';

import { createPortal } from 'react-dom';
import axios from 'axios';
import { ApiError } from '@/types/api.types';
import SupplierModal from '@/app/dashboard/proveedores/components/supplier-modal';
import { useNotification } from '@/components/notification-system';
import { useCreateSupplier } from '@/hooks/use-supplier-mutations';
import type { CreateSupplierDto, UpdateSupplierDto } from '@/hooks/use-supplier-mutations';

interface SupplierQuickCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string }) => void;
}

/**
 * Alta de proveedor desde otros formularios (artículo, albarán manual).
 * Usa el mismo modal completo que la página Proveedores para que se rellenen
 * todos los datos (CIF, dirección, registro sanitario, IBAN…).
 * Se monta en document.body para quedar siempre encima del modal que lo abre.
 */
export default function SupplierQuickCreateDialog({ isOpen, onClose, onCreated }: SupplierQuickCreateDialogProps) {
  const addNotification = useNotification();
  const createMutation = useCreateSupplier();

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      // El interceptor de apiClient desenvuelve { success, data } → result es el proveedor.
      const created = await createMutation.mutateAsync(data as CreateSupplierDto);
      addNotification({ type: 'success', title: 'Proveedor creado', message: `"${created.name}" añadido correctamente` });
      onCreated({ id: created.id, name: created.name });
      onClose();
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo crear el proveedor',
        message: axios.isAxiosError<ApiError>(error)
          ? (error.response?.data?.message || error.message || 'Error al crear proveedor')
          : (error instanceof Error ? error.message : 'Error al crear proveedor'),
      });
    }
  };

  return createPortal(
    <SupplierModal
      isOpen
      onClose={onClose}
      supplier={null}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
    />,
    document.body,
  );
}
