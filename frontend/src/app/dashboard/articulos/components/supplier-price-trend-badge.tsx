import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSupplierPriceTrend } from '@/hooks/use-suppliers';
import { cn } from '@/lib/utils';

interface Props {
  supplierId: string;
}

interface PriceTrend {
  status: 'increased' | 'decreased' | 'stable';
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}

export function SupplierPriceTrendBadge({ supplierId }: Props) {
  const { data, isLoading } = useSupplierPriceTrend(supplierId) as { data: PriceTrend | undefined; isLoading: boolean };

  if (isLoading) return <span className="text-gray-400 text-xs">Cargando...</span>;
  if (!data) return null;

  const { status, percentage, lastPrice, currentPrice } = data;

  const configs = {
    increased: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: TrendingUp,
      label: 'Subió'
    },
    decreased: {
      bg: 'bg-green-100',
      text: 'bg-green-700',
      icon: TrendingDown,
      label: 'Bajó'
    },
    stable: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: Minus,
      label: 'Sin cambios'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', config.bg, config.text)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {status !== 'stable' && <span>({percentage.toFixed(1)}%)</span>}
    </div>
  );
}