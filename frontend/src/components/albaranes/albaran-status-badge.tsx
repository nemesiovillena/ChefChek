'use client';

import { Badge } from '@/components/ui/badge';
import type { AlbaranStatus } from '@/lib/api-albaran';

interface AlbaranStatusBadgeProps {
  status: AlbaranStatus;
}

const statusConfig: Record<AlbaranStatus, { label: string; variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  PENDIENTE: { label: 'Pendiente', variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  REVISADO: { label: 'Revisado', variant: 'secondary', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  CONFIRMADO: { label: 'Confirmado', variant: 'secondary', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  ARCHIVADO: { label: 'Archivado', variant: 'outline', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
};

export function AlbaranStatusBadge({ status }: AlbaranStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
