'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Supplier } from '@/hooks/use-suppliers';
import { SupplierPriceTrendBadge } from '@/app/dashboard/articulos/components/supplier-price-trend-badge';
import { SupplierDetailPanel } from './supplier-detail-panel';

interface Props {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onToggleActive: (supplier: Supplier) => void;
  isToggling: boolean;
  isDeleting: boolean;
}

export function SupplierTable({ suppliers, onEdit, onDelete, onToggleActive, isToggling, isDeleting }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--outline-variant)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-container)]">
          <tr>
            <th className="w-8 px-2 py-3" />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Nombre</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Contacto</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Teléfono</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Tendencia</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => {
            const isExpanded = expandedId === supplier.id;
            return (
              <SupplierRow
                key={supplier.id}
                supplier={supplier}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedId((prev) => (prev === supplier.id ? null : supplier.id))}
                onToggleActive={() => onToggleActive(supplier)}
                onEdit={() => onEdit(supplier)}
                onDelete={() => onDelete(supplier)}
                isToggling={isToggling}
                isDeleting={isDeleting}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SupplierRow({
  supplier,
  isExpanded,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
  isToggling,
  isDeleting,
}: {
  supplier: Supplier;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  return (
    <>
      <tr className="border-t border-[var(--outline-variant)] transition-colors hover:bg-[var(--surface-container-low)]">
        <td className="px-2 py-3">
          <button
            onClick={onToggleExpand}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--surface-container-high)]"
            title={isExpanded ? 'Ocultar detalle' : 'Ver histórico y productos'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[var(--on-surface-variant)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)]" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-[var(--on-surface)]">{supplier.name}</p>
          {supplier.website && (
            <a
              href={supplier.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Web ↗
            </a>
          )}
        </td>
        <td className="px-4 py-3 text-[var(--on-surface-variant)]">
          {supplier.contactPerson || '—'}
          {supplier.email && <p className="text-xs text-[var(--on-surface-variant)]">{supplier.email}</p>}
        </td>
        <td className="px-4 py-3 text-[var(--on-surface-variant)]">{supplier.phone || supplier.whatsapp || '—'}</td>
        <td className="px-4 py-3">
          <button
            onClick={onToggleActive}
            disabled={isToggling}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all active:scale-95 ${
              supplier.isActive
                ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                : 'border-[var(--outline-variant)] bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span className={`h-2 w-2 rounded-full ${supplier.isActive ? 'bg-[var(--primary)]' : 'bg-[var(--on-surface-variant)]'}`} />
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </>
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <SupplierPriceTrendBadge supplierId={supplier.id} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={onEdit} title="Editar proveedor">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              onClick={onDelete}
              disabled={isDeleting}
              title="Eliminar proveedor"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-t border-[var(--outline-variant)]">
          <td colSpan={7} className="border-l-4 border-[var(--primary)]/40 bg-[var(--surface-container-lowest)] px-8 py-5">
            <SupplierDetailPanel supplierId={supplier.id} supplierName={supplier.name} />
          </td>
        </tr>
      )}
    </>
  );
}
