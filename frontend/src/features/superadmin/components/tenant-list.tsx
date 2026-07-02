'use client';

import { TenantSummary } from '../api/superadmin-api';

interface TenantListProps {
  tenants: TenantSummary[];
  selectedId: string | null;
  onSelect: (tenant: TenantSummary) => void;
}

export function TenantList({ tenants, selectedId, onSelect }: TenantListProps) {
  if (tenants.length === 0) {
    return (
      <div className="p-6 text-on-surface-variant font-label-md text-label-md text-center">
        No hay tenants registrados.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {tenants.map((tenant) => (
        <li key={tenant.id}>
          <button
            onClick={() => onSelect(tenant)}
            className={`w-full text-left px-stack-lg py-stack-md flex items-center justify-between transition-colors hover:bg-surface-variant ${
              selectedId === tenant.id ? 'bg-surface-container-low border-l-2 border-secondary' : ''
            }`}
          >
            <div>
              <p className="font-label-md text-label-md text-primary">{tenant.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{tenant.slug}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                tenant.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {tenant.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
