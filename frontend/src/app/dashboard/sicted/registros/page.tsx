'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSictedRuns, useSictedTemplates } from '@/hooks/use-sicted';
import { SictedMonthMatrix } from '../components/sicted-month-matrix';

export const dynamic = 'force-dynamic';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Registros: matriz mensual por plantilla — filas=ítems, columnas=periodos, para detectar huecos. */
export default function SictedRegistrosPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { data: templates, isLoading: loadingTemplates } = useSictedTemplates();
  const [templateId, setTemplateId] = useState<string>('');
  const [month, setMonth] = useState(currentMonthValue());

  const { from, to } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    return { from: start.toISOString(), to: end.toISOString() };
  }, [month]);

  const { data: runs, isLoading: loadingRuns } = useSictedRuns({ templateId: templateId || undefined, from, to });

  if (authLoading || loadingTemplates) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard/sicted')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a SICTED
      </button>
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Registros</h2>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Plantilla</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base"
            style={{ colorScheme: 'light dark' }}
          >
            <option value="">Elige una plantilla…</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.area})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Mes</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base"
            style={{ colorScheme: 'light dark' }}
          />
        </label>
      </div>

      {!templateId ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Elige una plantilla para ver su matriz.</p>
      ) : loadingRuns ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <SictedMonthMatrix runs={runs ?? []} />
      )}
    </div>
  );
}
