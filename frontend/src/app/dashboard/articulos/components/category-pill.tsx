'use client';

import { cn } from '@/lib/utils';

interface CategoryPillProps {
  name: string;
  color?: string | null;
  parentName?: string;
}

/** Colored pill/badge for category display in table rows */
export default function CategoryPill({ name, color, parentName }: CategoryPillProps) {
  const displayParent = parentName
    ? (parentName.length > 5 ? `${parentName.slice(0, 4)}.` : parentName)
    : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border max-w-full',
      )}
      style={{
        backgroundColor: color ? `${color}15` : undefined,
        borderColor: color ? `${color}40` : undefined,
        color: color || undefined,
      }}
    >
      {color && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="truncate whitespace-nowrap">
        {displayParent && <span className="opacity-60">{displayParent} › </span>}
        <span>{name}</span>
      </span>
    </span>
  );
}
