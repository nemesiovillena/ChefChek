'use client';

import { useState } from 'react';
import { confirmLine } from '@/lib/api-albaran';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { AlbaranLine } from '@/lib/api-albaran';

interface LineActionsToolbarProps {
  albaranId: string;
  lines: AlbaranLine[];
  onRefresh: () => void;
}

export function LineActionsToolbar({ albaranId, lines, onRefresh }: LineActionsToolbarProps) {
  const [loading, setLoading] = useState(false);

  // Count lines by status
  const pendingHighMatch = lines.filter(
    (l) => l.lineStatus === 'PENDIENTE' && l.matchStatus === 'MATCH_ALTO'
  );
  const pendingCount = lines.filter((l) => l.lineStatus === 'PENDIENTE').length;
  const confirmedCount = lines.filter((l) => l.lineStatus === 'CONFIRMADO').length;
  const rejectedCount = lines.filter((l) => l.lineStatus === 'RECHAZADO').length;

  const handleConfirmAllMatched = async () => {
    if (pendingHighMatch.length === 0) return;

    setLoading(true);
    try {
      // Confirm all MATCH_ALTO lines in parallel
      await Promise.all(
        pendingHighMatch.map((line) => confirmLine(albaranId, line.id))
      );
      onRefresh();
    } catch (err) {
      console.error('Error confirming lines:', err);
      alert(err instanceof Error ? err.message : 'Error al confirmar líneas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>{pendingCount} pendientes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>{confirmedCount} confirmadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>{rejectedCount} rechazadas</span>
        </div>
      </div>

      {pendingHighMatch.length > 0 && (
        <Button
          onClick={handleConfirmAllMatched}
          disabled={loading}
          variant="default"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Confirmar {pendingHighMatch.length} match alto
        </Button>
      )}
    </div>
  );
}
