'use client';

import { useEffect, useState } from 'react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  getTenant,
  type TenantSummary,
  type UpdateTenantPayload,
  type TenantDetail,
} from '../api/superadmin-api';
import { TenantModuleManager } from './tenant-module-manager';

interface ClientDetailsPanelProps {
  tenant: TenantSummary;
  update: (id: string, payload: UpdateTenantPayload) => Promise<TenantSummary>;
  deactivate: (id: string) => Promise<void>;
  onDeactivated: () => void;
}

type Tab = 'data' | 'modules';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'data', label: 'Datos del cliente' },
  { id: 'modules', label: 'Módulos' },
];

export function ClientDetailsPanel({
  tenant,
  update,
  deactivate,
  onDeactivated,
}: ClientDetailsPanelProps) {
  return <PanelForm key={tenant.id} tenant={tenant} update={update} deactivate={deactivate} onDeactivated={onDeactivated} />;
}

function PanelForm({ tenant, update, deactivate, onDeactivated }: ClientDetailsPanelProps) {
  const confirm = useConfirm();
  const notify = useNotification();
  const [tab, setTab] = useState<Tab>('data');
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: tenant.name ?? '',
    domain: tenant.domain ?? '',
    contactName: tenant.contactName ?? '',
    contactPosition: tenant.contactPosition ?? '',
    contactPhone: tenant.contactPhone ?? '',
    contactEmail: tenant.contactEmail ?? '',
    cifNif: tenant.cifNif ?? '',
    addressStreet: tenant.addressStreet ?? '',
    addressCity: tenant.addressCity ?? '',
    addressPostalCode: tenant.addressPostalCode ?? '',
  });

  useEffect(() => {
    let cancelled = false;
    getTenant(tenant.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        /* no crítico: la ficha sigue mostrándose con el resumen */
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Usuario OWNER/ADMIN vinculado (el creado en el alta). Sólo lectura aquí;
  // su gestión completa vive en /dashboard/users de ese tenant.
  const linkedAdmin =
    detail?.users?.find((u) => u.role === 'OWNER' || u.role === 'ADMIN') ??
    detail?.users?.[0] ??
    null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: UpdateTenantPayload = {
        name: form.name.trim(),
        domain: form.domain.trim() || null,
        contactName: form.contactName.trim() || null,
        contactPosition: form.contactPosition.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        cifNif: form.cifNif.trim() || null,
        addressStreet: form.addressStreet.trim() || null,
        addressCity: form.addressCity.trim() || null,
        addressPostalCode: form.addressPostalCode.trim() || null,
      };
      await update(tenant.id, payload);
    } catch (e) {
      notify({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Error inesperado',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: `Dar de baja a "${tenant.name}"`,
      description:
        'El cliente y todos sus usuarios perderán el acceso (no podrán iniciar sesión). Quedará en la papelera: podrás reactivarlo o borrarlo definitivamente.',
      confirmText: 'Dar de baja',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await deactivate(tenant.id);
      onDeactivated();
    } catch (e) {
      notify({
        type: 'error',
        title: 'No se pudo dar de baja',
        message: e instanceof Error ? e.message : 'Error inesperado',
      });
    }
  };

  return (
    <div>
      <div className="px-stack-lg py-stack-md border-b border-border">
        <div className="flex items-start justify-between gap-stack-md">
          <div>
            <h3 className="font-headline-md text-headline-md text-primary">{tenant.name}</h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              {tenant.slug}
              {tenant.domain ? ` · ${tenant.domain}` : ''}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
              tenant.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {tenant.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div role="tablist" className="flex gap-1 mt-stack-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-stack-md py-stack-sm rounded-t-lg font-label-md text-label-md cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-surface-container text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'data' && (
        <div className="px-stack-lg py-stack-lg space-y-stack-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="Nombre">
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Dominio">
              <input className={inputCls} value={form.domain} onChange={(e) => set('domain', e.target.value)} />
            </Field>
            <Field label="CIF / NIF">
              <input className={inputCls} value={form.cifNif} onChange={(e) => set('cifNif', e.target.value)} />
            </Field>
          </div>

          <SubSection title="Persona de contacto comercial">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <Field label="Nombre">
                <input className={inputCls} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              </Field>
              <Field label="Cargo">
                <input className={inputCls} value={form.contactPosition} onChange={(e) => set('contactPosition', e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <input className={inputCls} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
              </Field>
              <Field label="Email">
                <input className={inputCls} value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
              </Field>
            </div>
          </SubSection>

          <SubSection title="Dirección">
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-stack-md">
              <Field label="Calle">
                <input className={inputCls} value={form.addressStreet} onChange={(e) => set('addressStreet', e.target.value)} />
              </Field>
              <Field label="Código postal">
                <input className={inputCls} value={form.addressPostalCode} onChange={(e) => set('addressPostalCode', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 mt-stack-md">
              <Field label="Ciudad">
                <input className={inputCls} value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)} />
              </Field>
            </div>
          </SubSection>

          <SubSection title="Usuario administrador vinculado">
            {linkedAdmin ? (
              <div className="rounded-lg bg-surface-container-low ring-1 ring-border px-stack-md py-stack-sm font-label-md text-label-md text-on-surface">
                <span className="text-primary">{linkedAdmin.name}</span>
                <span className="text-on-surface-variant"> · {linkedAdmin.email}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">{linkedAdmin.role}</span>
              </div>
            ) : (
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {detail ? 'Sin usuario administrador.' : 'Cargando...'}
              </p>
            )}
          </SubSection>

          <div className="flex items-center justify-between gap-stack-md pt-stack-sm border-t border-border">
            <button
              onClick={handleDeactivate}
              className="px-stack-lg py-stack-sm rounded-full bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-90 cursor-pointer"
            >
              Dar de baja
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-stack-lg py-stack-sm rounded-full bg-primary text-primary-foreground font-label-md text-label-md hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {tab === 'modules' && <TenantModuleManager tenant={tenant} />}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg bg-surface-container-lowest ring-1 ring-border px-3 py-2 text-on-surface font-label-md text-label-md outline-none focus:ring-2 focus:ring-primary';

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="font-label-md text-label-md text-on-surface mb-stack-sm">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1 font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
