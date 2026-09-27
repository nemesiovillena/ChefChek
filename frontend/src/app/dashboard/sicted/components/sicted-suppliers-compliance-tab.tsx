'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useSictedSupplierCompliances, useSictedSupplierIncidents, useUpsertSictedSupplierCompliance } from '@/hooks/use-sicted-suppliers';
import {
  COMPLIANCE_TRISTATE,
  COMPLIANCE_TRISTATE_LABELS,
  type ComplianceTristate,
  type UpsertSupplierComplianceInput,
} from '@/lib/sicted-supplier-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

function TristateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ComplianceTristate;
  onChange: (v: ComplianceTristate) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-[var(--on-surface-variant)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as ComplianceTristate)} className={inputCls} style={{ colorScheme: 'light dark' }}>
        {COMPLIANCE_TRISTATE.map((t) => (
          <option key={t} value={t}>
            {COMPLIANCE_TRISTATE_LABELS[t]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Ficha de cumplimiento de un proveedor: nombre/contacto/RSI son evidencia (`Supplier`, fuera de este módulo); aquí solo lo que `Supplier` no tiene. */
function SictedSupplierComplianceCard({ supplierId, supplierName }: { supplierId: string; supplierName: string }) {
  const notify = useNotification();
  const { data: profiles } = useSictedSupplierCompliances();
  const { data: incidents } = useSictedSupplierIncidents(supplierId);
  const upsert = useUpsertSictedSupplierCompliance();
  const [expanded, setExpanded] = useState(false);

  const profile = profiles?.find((p) => p.supplierId === supplierId);
  const lastIncident = incidents?.[0];

  const [form, setForm] = useState<UpsertSupplierComplianceInput>({
    suppliedCategories: profile?.suppliedCategories ?? [],
    hasSafetyDataSheets: profile?.hasSafetyDataSheets ?? 'UNKNOWN',
    hasIndustrialRegistry: profile?.hasIndustrialRegistry ?? 'UNKNOWN',
    hasTechnicalSheets: profile?.hasTechnicalSheets ?? 'UNKNOWN',
    qualityCertification: profile?.qualityCertification ?? undefined,
  });
  function toggleExpand() {
    if (!expanded) {
      setForm({
        suppliedCategories: profile?.suppliedCategories ?? [],
        hasSafetyDataSheets: profile?.hasSafetyDataSheets ?? 'UNKNOWN',
        hasIndustrialRegistry: profile?.hasIndustrialRegistry ?? 'UNKNOWN',
        hasTechnicalSheets: profile?.hasTechnicalSheets ?? 'UNKNOWN',
        qualityCertification: profile?.qualityCertification ?? undefined,
      });
    }
    setExpanded((v) => !v);
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync({ supplierId, data: form });
      notify({ type: 'success', title: 'Perfil actualizado', message: '' });
      setExpanded(false);
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <button type="button" onClick={toggleExpand} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="font-medium">{supplierName}</p>
          {profile ? (
            <p className="flex items-center gap-1 text-sm text-[var(--on-surface-variant)]">
              <ShieldCheck className="h-3.5 w-3.5" /> Perfil actualizado por {profile.updatedByName}
            </p>
          ) : (
            <p className="text-sm text-[var(--on-surface-variant)]">Sin perfil de cumplimiento todavía</p>
          )}
          {lastIncident && (
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Última incidencia: {lastIncident.resolvedAt ? 'resuelta' : 'abierta'} ·{' '}
              {new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
                new Date(lastIncident.occurredAt),
              )}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-[var(--outline-variant)] pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TristateField
              label="Fichas de seguridad"
              value={form.hasSafetyDataSheets ?? 'UNKNOWN'}
              onChange={(v) => setForm((p) => ({ ...p, hasSafetyDataSheets: v }))}
            />
            <TristateField
              label="Registro industrial"
              value={form.hasIndustrialRegistry ?? 'UNKNOWN'}
              onChange={(v) => setForm((p) => ({ ...p, hasIndustrialRegistry: v }))}
            />
            <TristateField
              label="Fichas técnicas"
              value={form.hasTechnicalSheets ?? 'UNKNOWN'}
              onChange={(v) => setForm((p) => ({ ...p, hasTechnicalSheets: v }))}
            />
          </div>
          <input
            value={form.qualityCertification ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, qualityCertification: e.target.value }))}
            placeholder="Certificación de calidad (si tiene)"
            className={inputCls}
          />
          <input
            value={(form.suppliedCategories ?? []).join(', ')}
            onChange={(e) =>
              setForm((p) => ({ ...p, suppliedCategories: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))
            }
            placeholder="Categorías suministradas (separadas por coma): Perecederos, Congelados…"
            className={inputCls}
          />
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={handleSave}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Guardar perfil
          </button>
        </div>
      )}
    </div>
  );
}

/** PROV.1 — perfil de cumplimiento por proveedor. Nombre/contacto/RSI son evidencia (`Supplier`); esto es lo que `Supplier` no tiene. */
export function SictedSuppliersComplianceTab() {
  const { data: suppliers, isLoading } = useSuppliers({ isActive: true });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
        Sin proveedores activos. Dalos de alta en la sección Proveedores.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {suppliers.map((s) => (
        <SictedSupplierComplianceCard key={s.id} supplierId={s.id} supplierName={s.name} />
      ))}
    </div>
  );
}
