'use client';

import { useState } from 'react';
import { useNotification } from '@/components/notification-system';
import {
  createTenant,
  type CreateTenantPayload,
} from '../api/superadmin-api';

interface ClientFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  name: '',
  slug: '',
  domain: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  contactName: '',
  contactPosition: '',
  contactPhone: '',
  contactEmail: '',
  cifNif: '',
  addressStreet: '',
  addressCity: '',
  addressPostalCode: '',
};

/** Slug ligero (sin dependencias): lowercase, acentos fuera, no-alnum → '-'. */
function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Diálogo de alta de cliente (tenant). Crea el tenant + usuario admin inicial
 * y guarda los datos de contacto comerciales. Overlay propio con tokens M3
 * para encajar con el resto del superadmin.
 */
export function ClientFormDialog({
  isOpen,
  onClose,
  onCreated,
}: ClientFormDialogProps) {
  const notify = useNotification();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Nombre y slug son obligatorios' });
      return;
    }
    if (!form.adminEmail.trim() || !form.adminName.trim()) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Indica la persona de contacto inicial (admin)' });
      return;
    }
    if (form.adminPassword.length < 8) {
      notify({ type: 'error', title: 'Contraseña débil', message: 'Mínimo 8 caracteres' });
      return;
    }

    const payload: CreateTenantPayload = {
      name: form.name.trim(),
      slug: slugify(form.slug),
      domain: form.domain.trim() || undefined,
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
      adminPassword: form.adminPassword,
      adminRole: 'ADMIN',
      contactName: form.contactName.trim() || undefined,
      contactPosition: form.contactPosition.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      cifNif: form.cifNif.trim() || undefined,
      addressStreet: form.addressStreet.trim() || undefined,
      addressCity: form.addressCity.trim() || undefined,
      addressPostalCode: form.addressPostalCode.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await createTenant(payload);
      setForm(EMPTY);
      onCreated();
      onClose();
    } catch (e) {
      notify({
        type: 'error',
        title: 'No se pudo crear el cliente',
        message: e instanceof Error ? e.message : 'Error inesperado',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface-container-high ring-1 ring-border my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-stack-lg py-stack-md">
          <h2 className="font-headline-md text-headline-md text-primary">Nuevo cliente</h2>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-on-surface-variant hover:text-error cursor-pointer"
          >
            close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-stack-lg py-stack-lg space-y-stack-lg">
          <Section title="Empresa">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <Field label="Nombre *">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, name: v, slug: f.slug || slugify(v) }));
                  }}
                  placeholder="Restaurante S.L."
                />
              </Field>
              <Field label="Slug *">
                <input
                  className={inputCls}
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="restaurante-sl"
                />
              </Field>
              <Field label="Dominio">
                <input
                  className={inputCls}
                  value={form.domain}
                  onChange={(e) => set('domain', e.target.value)}
                  placeholder="midominio.com"
                />
              </Field>
              <Field label="CIF / NIF">
                <input
                  className={inputCls}
                  value={form.cifNif}
                  onChange={(e) => set('cifNif', e.target.value)}
                  placeholder="B12345678"
                />
              </Field>
            </div>
          </Section>

          <Section title="Persona de contacto (usuario admin inicial)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <Field label="Nombre del admin *">
                <input
                  className={inputCls}
                  value={form.adminName}
                  onChange={(e) => set('adminName', e.target.value)}
                  placeholder="María García"
                />
              </Field>
              <Field label="Email del admin *">
                <input
                  className={inputCls}
                  value={form.adminEmail}
                  onChange={(e) => set('adminEmail', e.target.value)}
                  placeholder="admin@empresa.com"
                />
              </Field>
              <Field label="Contraseña inicial *" hint="Mínimo 8 caracteres">
                <input
                  type="password"
                  className={inputCls}
                  value={form.adminPassword}
                  onChange={(e) => set('adminPassword', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Datos de contacto comercial" hint="Opcional">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <Field label="Persona de contacto">
                <input
                  className={inputCls}
                  value={form.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  placeholder="Contacto comercial"
                />
              </Field>
              <Field label="Cargo">
                <input
                  className={inputCls}
                  value={form.contactPosition}
                  onChange={(e) => set('contactPosition', e.target.value)}
                  placeholder="Gerente"
                />
              </Field>
              <Field label="Teléfono">
                <input
                  className={inputCls}
                  value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  placeholder="600 000 000"
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputCls}
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  placeholder="comercial@empresa.com"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-stack-md mt-stack-md">
              <Field label="Dirección">
                <input
                  className={inputCls}
                  value={form.addressStreet}
                  onChange={(e) => set('addressStreet', e.target.value)}
                  placeholder="Calle ..."
                />
              </Field>
              <Field label="Código postal">
                <input
                  className={inputCls}
                  value={form.addressPostalCode}
                  onChange={(e) => set('addressPostalCode', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 mt-stack-md">
              <Field label="Ciudad">
                <input
                  className={inputCls}
                  value={form.addressCity}
                  onChange={(e) => set('addressCity', e.target.value)}
                />
              </Field>
            </div>
          </Section>
        </div>

        <div className="flex justify-end gap-stack-md border-t border-border px-stack-lg py-stack-md">
          <button
            onClick={onClose}
            className="px-stack-lg py-stack-sm rounded-full text-on-surface-variant hover:bg-surface-variant font-label-md text-label-md cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-stack-lg py-stack-sm rounded-full bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg bg-surface-container-lowest ring-1 ring-border px-3 py-2 text-on-surface font-label-md text-label-md outline-none focus:ring-2 focus:ring-primary';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-stack-sm">
        <h3 className="font-label-lg text-label-lg text-on-surface">{title}</h3>
        {hint && (
          <p className="font-label-sm text-label-sm text-on-surface-variant">{hint}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1 font-label-sm text-label-sm text-on-surface-variant">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block mt-1 font-label-sm text-label-sm text-on-surface-variant/70">
          {hint}
        </span>
      )}
    </label>
  );
}
