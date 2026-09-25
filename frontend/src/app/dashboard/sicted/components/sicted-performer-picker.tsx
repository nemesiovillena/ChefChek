'use client';

import { User } from 'lucide-react';
import { useSictedPerformers } from '@/hooks/use-sicted';

export interface SictedPerformer {
  userId?: string;
  name: string;
}

interface SictedPerformerPickerProps {
  value: SictedPerformer | null;
  onChange: (performer: SictedPerformer | null) => void;
}

/**
 * Selector "¿Quién lo hizo?" — sin PIN (decisión confirmada), solo elegir un
 * nombre de la lista de personas activas del tenant. El valor se mantiene en
 * el estado del padre (persiste mientras dure la sesión de la hoja abierta).
 */
export function SictedPerformerPicker({ value, onChange }: SictedPerformerPickerProps) {
  const { data: performers, isLoading } = useSictedPerformers();

  return (
    <label className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm">
      <User className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
      <span className="shrink-0 text-[var(--on-surface-variant)]">Quién:</span>
      <select
        value={value?.userId ?? ''}
        disabled={isLoading}
        onChange={(e) => {
          const userId = e.target.value;
          const performer = (performers ?? []).find((p) => p.id === userId);
          onChange(performer ? { userId: performer.id, name: performer.name } : null);
        }}
        className="min-h-[40px] w-full flex-1 bg-transparent text-base outline-none"
        style={{ colorScheme: 'light dark' }}
      >
        <option value="">Elige tu nombre…</option>
        {(performers ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
