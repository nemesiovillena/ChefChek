'use client';

interface StockBadgeProps {
  current: number;
  minimum?: number;
  maximum?: number;
  unit?: string;
}

/** Traffic-light stock badge: green > min, yellow between 0 and min, red = 0 */
export default function StockBadge({ current, minimum, maximum, unit = '' }: StockBadgeProps) {
  const min = minimum ?? 0;
  const isOk = current > min;
  const isLow = current > 0 && current <= min;
  const isEmpty = current <= 0;

  const colorClass = isOk
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isLow
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';

  const dotColor = isOk
    ? 'bg-emerald-500'
    : isLow
    ? 'bg-amber-500'
    : 'bg-red-500';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${colorClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {current.toFixed(current % 1 === 0 ? 0 : 2)}
      {unit && <span className="text-[10px] opacity-70">{unit}</span>}
    </span>
  );
}