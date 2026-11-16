'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import {
  type DateRange,
  type ExportFormat,
  type GestionReportParams,
  downloadGestionReport,
  useGestionReport,
} from '../api/gestion-api';
import type { ReportDefinition } from '../gestion-report-catalog';
import { GestionReportTable } from './gestion-report-table';
import { PeriodPicker } from './period-picker';

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV' },
  { id: 'pdf', label: 'PDF' },
];

const thisYear = new Date().getFullYear();

/** Informe con tabla común: filtros, «Generar» en pantalla y descarga en 3 formatos. */
export function GestionReportView({ report }: { report: ReportDefinition }) {
  const notify = useNotification();
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth'));
  const [year, setYear] = useState(thisYear);
  const [years, setYears] = useState(3);
  const [options, setOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries((report.options ?? []).map((o) => [o.param, o.initial])),
  );
  const [shown, setShown] = useState<GestionReportParams | null>(null);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const { data, isFetching, error } = useGestionReport(report.key, shown);

  const params: GestionReportParams =
    report.input === 'years'
      ? { year, years, ...options }
      : report.input === 'year'
        ? { year, ...options }
        : { ...range, ...options };
  const invalid = report.input === 'range' && range.from > range.to;

  async function download(format: ExportFormat) {
    setDownloading(format);
    try {
      await downloadGestionReport(report.key, params, format);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo descargar el informe', message: err instanceof Error ? err.message : '' });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        {report.input === 'range' ? (
          <PeriodPicker
            preset={preset}
            range={range}
            onChange={(p, r) => {
              setPreset(p);
              setRange(r);
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[9rem] flex-1 flex-col">
              <span className={labelCls}>{report.input === 'year' ? 'Año' : 'Hasta el año'}</span>
              <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {Array.from({ length: 8 }, (_, i) => thisYear - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            {report.input === 'years' && (
            <label className="flex min-w-[9rem] flex-1 flex-col">
              <span className={labelCls}>Años a comparar</span>
              <select className={inputCls} value={years} onChange={(e) => setYears(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            )}
          </div>
        )}
        {report.options && (
          <div className="flex flex-wrap gap-3">
            {report.options.map((o) => (
              <label key={o.param} className="flex min-w-[9rem] flex-1 flex-col">
                <span className={labelCls}>{o.label}</span>
                <select
                  className={inputCls}
                  value={options[o.param]}
                  onChange={(e) => setOptions({ ...options, [o.param]: e.target.value })}
                >
                  {o.choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="min-h-[44px]" disabled={invalid} onClick={() => setShown(params)}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver en pantalla'}
          </Button>
          {FORMATS.map((f) => (
            <Button
              key={f.id}
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={invalid || downloading !== null}
              onClick={() => download(f.id)}
            >
              {downloading === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {f.label}
            </Button>
          ))}
        </div>
        {invalid && <p className="text-sm text-[var(--error)]">La fecha «Desde» es posterior a «Hasta».</p>}
      </div>

      {error && <p className="text-sm text-[var(--error)]">No se pudo generar el informe: {error.message}</p>}
      {data && (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <div className="mb-3">
            <div className="font-semibold text-[var(--on-surface)]">{data.title}</div>
            <div className="text-sm text-[var(--on-surface-variant)]">{data.subtitle}</div>
          </div>
          <GestionReportTable table={data} />
        </div>
      )}
    </div>
  );
}
