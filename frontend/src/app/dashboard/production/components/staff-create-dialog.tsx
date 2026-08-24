'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateStaffMemberInput } from '@/hooks/use-production-staff';

interface StaffCreateDialogProps {
  onClose: () => void;
  onSubmit: (input: CreateStaffMemberInput) => Promise<void>;
  isSubmitting: boolean;
  initial?: { name: string; role: string; email?: string | null };
}

export default function StaffCreateDialog({ onClose, onSubmit, isSubmitting, initial }: StaffCreateDialogProps) {
  const isEditing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  const canSubmit = name.trim() !== '' && role.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({ name, role, email: email.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-md shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Editar miembro de personal' : 'Nuevo miembro de personal'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lucía Fernández" />
          </div>
          <div>
            <Label>Rol</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej: Cocinera" />
          </div>
          <div>
            <Label>Email (opcional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isEditing
                ? isSubmitting ? 'Guardando...' : 'Guardar'
                : isSubmitting ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
