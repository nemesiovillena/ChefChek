'use client';

import { SupplierForm } from '@/app/dashboard/articulos/components/supplier-form';
import type { Supplier } from '@/hooks/use-suppliers';
import type { CreateSupplierDto, UpdateSupplierDto } from '@/hooks/use-supplier-mutations';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>;
  isSubmitting: boolean;
}

/** Centered dialog matching the app's other entity modals (Artículos, Usuarios), replacing the previous side sheet. */
export default function SupplierModal({ isOpen, onClose, supplier, onSubmit, isSubmitting }: SupplierModalProps) {
  if (!isOpen) return null;
  // Keyed remount resets form state when switching between create/edit targets.
  return (
    <SupplierModalForm
      key={supplier?.id ?? 'new'}
      supplier={supplier}
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}

interface SupplierModalFormProps {
  supplier?: Supplier | null;
  onClose: () => void;
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>;
  isSubmitting: boolean;
}

function SupplierModalForm({ supplier, onClose, onSubmit, isSubmitting }: SupplierModalFormProps) {
  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {supplier ? `Editar: ${supplier.name}` : 'Nuevo proveedor'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <SupplierForm
          supplier={supplier}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
