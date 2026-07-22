'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useNotification } from '@/components/notification-system';
import { useCreateUser, useUpdateUser, useUploadUserAvatar, User } from '@/hooks/use-users';
import { processImageForUpload } from '@/lib/image-processing';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: User | null;
  currentTenantId: string | null;
  /** Llamado tras guardar con éxito (antes de cerrar). */
  onSaved?: () => void;
}

/** Outer component: keeps hooks stable and mounts the form keyed by the edited entity. */
export default function UserModal({ isOpen, onClose, targetUser, currentTenantId, onSaved }: UserModalProps) {
  if (!isOpen) return null;
  return (
    <UserModalForm
      key={targetUser?.id ?? 'new'}
      targetUser={targetUser}
      currentTenantId={currentTenantId}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface UserModalFormProps {
  targetUser?: User | null;
  currentTenantId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

function UserModalForm({ targetUser, currentTenantId, onClose, onSaved }: UserModalFormProps) {
  const addNotification = useNotification();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const uploadAvatarMutation = useUploadUserAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(() => ({
    email: targetUser?.email ?? '',
    name: targetUser?.name ?? '',
    password: '',
    role: targetUser?.role ?? 'USER',
    isActive: targetUser?.isActive ?? true,
    street: targetUser?.street ?? '',
    city: targetUser?.city ?? '',
    phone: targetUser?.phone ?? '',
    whatsapp: targetUser?.whatsapp ?? '',
    payrollEmail: targetUser?.payrollEmail ?? '',
  }));
  const [avatarUrl, setAvatarUrl] = useState(() => targetUser?.avatarUrl ?? '');
  const [samePhoneForWhatsapp, setSamePhoneForWhatsapp] = useState(
    () => !!targetUser && !!targetUser.phone && targetUser.phone === targetUser.whatsapp,
  );

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    try {
      // Re-encode to a resized JPEG first: normalizes non-standard source
      // mimetypes (the image/jpg JPEG alias, HEIC where the browser can
      // decode it) and shrinks phone photos so they stay under the limit.
      const processed = await processImageForUpload(file);
      if (processed.size > 2 * 1024 * 1024) {
        addNotification({ type: 'error', title: 'Error', message: 'El archivo no puede superar los 2 MB' });
        return;
      }
      const form = new FormData();
      form.append('file', processed);
      const result = await uploadAvatarMutation.mutateAsync(form);
      setAvatarUrl(result.avatarUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al subir la foto';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const handlePhoneChange = (value: string) => {
    setFormData((f) => ({ ...f, phone: value, whatsapp: samePhoneForWhatsapp ? value : f.whatsapp }));
  };

  const handleSubmit = async () => {
    if (!formData.email.trim() || !formData.name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'Email y nombre son obligatorios' });
      return;
    }
    if (!targetUser && formData.password.length < 8) {
      addNotification({ type: 'error', title: 'Error', message: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }
    if (!targetUser && !currentTenantId) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo determinar el tenant actual' });
      return;
    }

    const commonData = {
      email: formData.email,
      name: formData.name,
      role: formData.role,
      isActive: formData.isActive,
      avatarUrl: avatarUrl || undefined,
      street: formData.street || undefined,
      city: formData.city || undefined,
      phone: formData.phone || undefined,
      whatsapp: formData.whatsapp || undefined,
      payrollEmail: formData.payrollEmail || undefined,
    };

    try {
      if (targetUser) {
        await updateMutation.mutateAsync({
          id: targetUser.id,
          ...commonData,
          ...(formData.password ? { password: formData.password } : {}),
        });
        addNotification({ type: 'success', title: 'Usuario actualizado', message: 'Usuario actualizado correctamente' });
      } else {
        await createMutation.mutateAsync({
          tenantId: currentTenantId as string,
          password: formData.password,
          ...commonData,
        });
        addNotification({ type: 'success', title: 'Usuario creado', message: 'Usuario creado correctamente' });
      }
      onSaved?.();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar usuario';
      addNotification({ type: 'error', title: 'Error', message });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const inputClass = 'w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {targetUser ? 'Editar Usuario' : 'Crear Usuario'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Cuenta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{targetUser ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={8}
                placeholder={targetUser ? 'Dejar en blanco para no cambiar' : undefined}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Rol</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })} className={inputClass}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Usuario activo</label>
          </div>

          {/* Foto */}
          <div>
            <label className={labelClass}>Foto de perfil</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                Subir foto
              </button>
              <span className="text-xs text-gray-400">Máximo 2 MB (JPEG, PNG, WebP, GIF, HEIC)</span>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" onChange={handleAvatarFileChange} className="hidden" />
            </div>
            {avatarUrl && (
              <div className="mt-3">
                <Image src={avatarUrl} alt="Foto de perfil" width={64} height={64} className="w-16 h-16 object-cover rounded-full border" />
              </div>
            )}
          </div>

          {/* Dirección */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Calle</label>
              <input type="text" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
            </div>
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Teléfono</label>
              <input type="tel" value={formData.phone} onChange={(e) => handlePhoneChange(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input
                type="tel"
                value={formData.whatsapp}
                disabled={samePhoneForWhatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className={`${inputClass} disabled:opacity-60`}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 -mt-2">
            <input
              type="checkbox"
              id="samePhoneForWhatsapp"
              checked={samePhoneForWhatsapp}
              onChange={(e) => {
                setSamePhoneForWhatsapp(e.target.checked);
                if (e.target.checked) {
                  setFormData((f) => ({ ...f, whatsapp: f.phone }));
                }
              }}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="samePhoneForWhatsapp" className="text-sm text-gray-700 dark:text-gray-300">Usar el mismo número para WhatsApp</label>
          </div>

          {/* Nóminas */}
          <div>
            <label className={labelClass}>Email de nóminas</label>
            <input type="email" value={formData.payrollEmail} onChange={(e) => setFormData({ ...formData, payrollEmail: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors">
            Cerrar
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSaving} className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
