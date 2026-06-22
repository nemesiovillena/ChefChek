import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  stockAlerts: { low: number; empty: number };
  onViewAlerts: () => void;
}

export function StockAlertsCard({ stockAlerts, onViewAlerts }: Props) {
  const total = stockAlerts.low + stockAlerts.empty;
  const hasAlerts = total > 0;

  return (
    <div
      className={`bg-white border rounded-lg p-6 hover:shadow-md transition cursor-pointer ${
        hasAlerts ? 'border-red-200' : ''
      }`}
      onClick={onViewAlerts}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${hasAlerts ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertTriangle className={`h-6 w-6 ${hasAlerts ? 'text-red-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Alertas de stock</p>
            <p className={`text-3xl font-bold ${hasAlerts ? 'text-red-600' : 'text-gray-900'}`}>
              {total}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            Agotados
          </span>
          <span className="font-medium text-red-600">{stockAlerts.empty}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            Bajo stock
          </span>
          <span className="font-medium text-yellow-600">{stockAlerts.low}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2 mt-4">
        <TrendingDown className="h-4 w-4" />
        Ver alertas
      </Button>
    </div>
  );
}