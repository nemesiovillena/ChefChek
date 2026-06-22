'use client';

import { Badge } from '@/components/ui/badge';
import type { MatchStatus } from '@/lib/api-albaran';

interface LineMatchBadgeProps {
  matchStatus: MatchStatus;
  confidence?: number | null;
}

const matchConfig: Record<MatchStatus, { label: string; className: string }> = {
  NUEVO: { label: 'Nuevo', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  MATCH_ALTO: { label: 'Match Alto', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  MATCH_DUDOSO: { label: 'Match Dudoso', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
};

export function LineMatchBadge({ matchStatus, confidence }: LineMatchBadgeProps) {
  const config = matchConfig[matchStatus];
  const displayConfidence = confidence ? ` (${Math.round(confidence * 100)}%)` : '';

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}{displayConfidence}
    </Badge>
  );
}
