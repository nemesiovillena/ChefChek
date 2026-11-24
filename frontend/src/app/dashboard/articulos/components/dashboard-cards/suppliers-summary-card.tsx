import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  supplierCount: number;
  onManageSuppliers: () => void;
}

export function SuppliersSummaryCard({ supplierCount, onManageSuppliers }: Props) {
  return (
    <div
      className="bg-surface-raised border rounded-lg p-6 hover:shadow-md transition cursor-pointer"
      onClick={onManageSuppliers}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary-container/50 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-text-muted">Proveedores activos</p>
            <p className="text-3xl font-bold text-text-strong">{supplierCount}</p>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2">
        <Users className="h-4 w-4" />
        Gestionar proveedores
      </Button>
    </div>
  );
}