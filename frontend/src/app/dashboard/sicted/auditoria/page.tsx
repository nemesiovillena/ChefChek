'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useSictedTemplates } from '@/hooks/use-sicted';
import { openSictedAuditDownload, useSictedCoverage } from '@/hooks/use-sicted-audit';

export const dynamic = 'force-dynamic';

const inputCls =
  'min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Pack de auditoría: PDFs deterministas del Plan/Registros/Mantenimiento, CSV, y el panel de cobertura ("¿qué falta?"). */
export default function SictedAuditoriaPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const notify = useNotification();
  const { data: templates } = useSictedTemplates();

  const [month, setMonth] = useState(currentMonthValue());
  const [templateId, setTemplateId] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { from, to } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
      to: new Date(Date.UTC(y, m, 1)).toISOString(),
    };
  }, [month]);

  const { data: coverage, isLoading: loadingCoverage } = useSictedCoverage(from, to);

  const blockedNotice = () =>
    notify({ type: 'error', title: 'Ventana bloqueada', message: 'Permite popups para este sitio e inténtalo de nuevo.' });

  if (authLoading) return null;

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
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Auditoría</h2>

      <section className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="mb-3 font-semibold">Descargas</h3>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => openSictedAuditDownload('/plan.pdf', {}, 'application/pdf', blockedNotice)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Plan (PDF)
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-[var(--on-surface-variant)]">Plantilla</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${inputCls} mt-1`} style={{ colorScheme: 'light dark' }}>
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
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} mt-1`} style={{ colorScheme: 'light dark' }} />
          </label>
          <button
            type="button"
            disabled={!templateId}
            onClick={() => openSictedAuditDownload('/registros.pdf', { templateId, month }, 'application/pdf', blockedNotice)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Cuadrante mensual (PDF)
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-[var(--on-surface-variant)]">Año</span>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={`${inputCls} mt-1 w-24`} />
          </label>
          <button
            type="button"
            onClick={() => openSictedAuditDownload('/mantenimiento.pdf', { year }, 'application/pdf', blockedNotice)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Mantenimiento (PDF)
          </button>
          <button
            type="button"
            onClick={() => openSictedAuditDownload('/registros.csv', { from, to }, 'text/csv', blockedNotice)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
          >
            <FileSpreadsheet className="h-4 w-4" /> Marcas del mes (CSV)
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Cobertura — {month}</h3>
        {loadingCoverage ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          </div>
        ) : coverage ? (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-center">
                <p className="text-2xl font-semibold">{coverage.expected}</p>
                <p className="text-xs text-[var(--on-surface-variant)]">Esperadas</p>
              </div>
              <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-center">
                <p className="text-2xl font-semibold text-[var(--primary)]">{coverage.completed}</p>
                <p className="text-xs text-[var(--on-surface-variant)]">Completadas</p>
              </div>
              <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-semibold text-[var(--primary)]">
                  <ShieldCheck className="h-5 w-5" /> {coverage.validated}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">Validadas</p>
              </div>
            </div>

            {coverage.gaps.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">Sin huecos en este periodo.</p>
            ) : (
              <div className="space-y-1">
                {coverage.gaps.map((gap) => (
                  <div
                    key={`${gap.templateId}-${gap.periodKey}`}
                    onClick={() => gap.runId && router.push(`/dashboard/sicted/registros/${gap.runId}`)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      gap.status === 'MISSING' ? 'bg-[var(--error-container)] text-[var(--on-error-container)]' : 'bg-[var(--surface-container)]'
                    } ${gap.runId ? 'cursor-pointer hover:opacity-80' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {gap.templateName} ({gap.area}) — {gap.periodKey}
                    </span>
                    <span className="text-xs font-semibold">{gap.status === 'MISSING' ? 'Sin generar' : 'Incompleta'}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
