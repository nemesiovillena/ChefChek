'use client';

import { useState } from 'react';
import { AlertTriangle, Download, FileBarChart, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { openSictedAnnualReportPdf, useSictedAnnualReport } from '@/hooks/use-sicted-direccion';

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4';

/** Informe anual de calidad (DIR.10, SICTED fase 9, sub-PR 4) — agregado de solo lectura, no un documento manual. */
export function SictedDireccionReportTab() {
  const notify = useNotification();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: report, isLoading } = useSictedAnnualReport(year);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await openSictedAnnualReportPdf(year, () =>
        notify({ type: 'error', title: 'El navegador bloqueó la pestaña nueva', message: 'Permite pop-ups para descargar el PDF.' }),
      );
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[40px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={downloading}
          onClick={handleDownload}
          className="ml-auto flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generar informe anual (PDF)
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <FileBarChart className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin datos para {year}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Autoevaluación</p>
            {report.assessment ? (
              <>
                <p className="font-medium">{report.assessment.label}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  Cerrada {new Date(report.assessment.closedAt).toLocaleDateString('es-ES')}
                </p>
                {report.assessment.pendingMandatoryCount > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-[var(--error)]">
                    <AlertTriangle className="h-3.5 w-3.5" /> {report.assessment.pendingMandatoryCount} obligatorias pendientes o &lt;3
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--on-surface-variant)]">Sin autoevaluación cerrada este año.</p>
            )}
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Objetivos</p>
            <p className="text-2xl font-semibold text-[var(--primary)]">{report.objectives.length}</p>
            <p className="text-sm text-[var(--on-surface-variant)]">registrados para {year}</p>
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Plan de mejora</p>
            <p className="text-2xl font-semibold text-[var(--primary)]">{report.improvementActions.closedThisYearCount}</p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              implantadas este año · {report.improvementActions.openCount} abiertas actualmente
            </p>
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Participación</p>
            {report.events.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">Sin eventos este año.</p>
            ) : (
              report.events.map((e) => (
                <p key={e.kind} className="text-sm">
                  {e.kind}: {e.count}
                </p>
              ))
            )}
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Proveedores</p>
            <p className="text-2xl font-semibold text-[var(--primary)]">{report.supplierIncidents.count}</p>
            <p className="text-sm text-[var(--on-surface-variant)]">incidencias · {report.supplierIncidents.resolvedCount} resueltas</p>
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Formación</p>
            <p className="text-2xl font-semibold text-[var(--primary)]">
              {report.training.actionsDone}/{report.training.actionsTotal}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">acciones hechas · {report.training.plansCount} plan(es)</p>
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Cliente</p>
            <p className="text-sm">
              {report.feedback.total} quejas/sugerencias · {report.feedback.open} abiertas
              {report.feedback.overdue > 0 && <span className="text-[var(--error)]"> · {report.feedback.overdue} vencidas</span>}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              Satisfacción: {report.satisfaction.samplesCount} muestra(s)
              {report.satisfaction.averageScore !== null ? ` · media ${report.satisfaction.averageScore.toFixed(1)}/5` : ''}
            </p>
          </div>

          <div className={cardCls}>
            <p className="mb-1 text-xs uppercase text-[var(--on-surface-variant)]">Documentos legales vigentes</p>
            <p className="text-2xl font-semibold text-[var(--primary)]">{report.legalDocs.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
