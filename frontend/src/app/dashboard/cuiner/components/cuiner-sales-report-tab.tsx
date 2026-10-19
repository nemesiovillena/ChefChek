'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { downloadCuinerSalesReport, useCuinerSalesReport } from '@/hooks/use-cuiner';
import type { SalesReportFormat, SalesReportGroupBy, SalesReportQuery } from '@/lib/cuiner-types';
import {
  DISH_LEVEL,
  GROUP_BY_OPTIONS,
  LEVEL_OPTIONS,
  RANGE_PRESETS,
  type RangePreset,
  defaultGroupBy,
  formatDay,
  presetRange,
} from '@/lib/cuiner-sales-report-ranges';
import { inputCls } from './cuiner-link-cell';

/** Igual que en el servidor: platos sin familia en la carta de Cuiner. */
const NO_FAMILY = 'Sin familia';
import { CuinerSalesReportTable } from './cuiner-sales-report-table';

type Output = 'screen' | SalesReportFormat;
const OUTPUTS: { id: Output; label: string }[] = [
  { id: 'screen', label: 'Pantalla' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV' },
  { id: 'pdf', label: 'PDF' },
];

const labelCls = 'flex min-w-[9rem] flex-1 flex-col gap-1 text-sm';

/**
 * Informe de ventas del TPV: periodo, agrupación y nivel de familia, y la
 * salida elegida (pantalla o descarga en Excel, CSV o PDF). En pantalla, al
 * pulsar una familia se baja un nivel dentro de ella.
 */
export function CuinerSalesReportTab() {
  const notify = useNotification();
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [custom, setCustom] = useState(() => presetRange('thisMonth'));
  const [groupBy, setGroupBy] = useState<SalesReportGroupBy>('day');
  const [level, setLevel] = useState(1);
  const [output, setOutput] = useState<Output>('screen');
  const [downloading, setDownloading] = useState(false);
  // Consulta mostrada en pantalla: cambia al pulsar «Generar» o al bajar de nivel.
  const [shown, setShown] = useState<SalesReportQuery | null>(null);
  const report = useCuinerSalesReport(shown);

  const range = preset === 'custom' ? custom : presetRange(preset);
  const draft: SalesReportQuery = { ...range, groupBy, level };

  async function generate() {
    if (draft.from > draft.to) {
      notify({ type: 'error', title: 'Fechas al revés', message: 'La fecha «Desde» es posterior a «Hasta».' });
      return;
    }
    if (output === 'screen') {
      setShown(draft);
      return;
    }
    setDownloading(true);
    try {
      await downloadCuinerSalesReport(draft, output);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo descargar el informe', message: err instanceof Error ? err.message : '' });
    } finally {
      setDownloading(false);
    }
  }

  async function downloadShown(format: SalesReportFormat) {
    if (!shown) return;
    try {
      await downloadCuinerSalesReport(shown, format);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo descargar el informe', message: err instanceof Error ? err.message : '' });
    }
  }

  const familyTrail = shown?.family ? shown.family.split('-') : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className={labelCls}>
          Periodo
          <select
            className={inputCls}
            value={preset}
            onChange={(e) => {
              const next = e.target.value as RangePreset;
              if (next === 'custom') setCustom(range);
              setPreset(next);
              setGroupBy(defaultGroupBy(next));
            }}
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' ? (
          <>
            <label className={labelCls}>
              Desde
              <input type="date" className={inputCls} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className={labelCls}>
              Hasta
              <input type="date" className={inputCls} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
          </>
        ) : (
          <p className="min-w-[9rem] flex-1 pb-3 text-sm text-muted-foreground">
            {range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`}
          </p>
        )}
        <label className={labelCls}>
          Agrupar
          <select className={inputCls} value={groupBy} onChange={(e) => setGroupBy(e.target.value as SalesReportGroupBy)}>
            {GROUP_BY_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Detalle
          <select className={inputCls} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Salida
          <select className={inputCls} value={output} onChange={(e) => setOutput(e.target.value as Output)}>
            {OUTPUTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" className="min-h-[44px]" onClick={generate} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : output === 'screen' ? 'Generar' : 'Descargar'}
        </Button>
      </div>

      {report.data && !report.data.history.done && (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          El histórico de Cuiner se está importando
          {report.data.history.oldestDate ? ` (de momento, desde el ${formatDay(report.data.history.oldestDate)})` : ''}: los periodos
          más antiguos pueden salir incompletos.
        </p>
      )}
      {report.data && report.data.missingAmounts > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {report.data.missingAmounts} líneas de venta aún no tienen importe: cuentan unidades pero no euros hasta que el conector
          las complete.
        </p>
      )}

      {shown && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className="text-primary hover:underline" disabled={!shown.family} onClick={() => setShown({ ...shown, family: undefined, level: 1 })}>
            Todas las familias
          </button>
          {familyTrail.map((part, i) => {
            const path = familyTrail.slice(0, i + 1).join('-');
            return (
              <span key={path} className="flex items-center gap-2">
                <span className="text-muted-foreground">›</span>
                <button type="button" className="text-primary hover:underline" onClick={() => setShown({ ...shown, family: path, level: Math.min(i + 2, DISH_LEVEL) })}>
                  {part}
                </button>
              </span>
            );
          })}
          <span className="ml-auto flex gap-2">
            {OUTPUTS.filter((o): o is { id: SalesReportFormat; label: string } => o.id !== 'screen').map((o) => (
              <Button key={o.id} type="button" size="sm" variant="outline" onClick={() => downloadShown(o.id)}>
                {o.label}
              </Button>
            ))}
          </span>
        </div>
      )}

      {report.isLoading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-muted-foreground" />}
      {report.error && <p className="text-sm text-red-600">{report.error.message}</p>}
      {report.data && shown && (
        <div className={report.isFetching ? 'opacity-60 transition-opacity' : ''}>
          <CuinerSalesReportTable
            report={report.data}
            onDrillDown={(row) =>
              // «Sin familia» no tiene subniveles: se baja directamente a sus platos.
              setShown({
                ...shown,
                family: row.key,
                level: row.key === NO_FAMILY ? DISH_LEVEL : Math.min(shown.level + 1, DISH_LEVEL),
              })
            }
          />
        </div>
      )}
      {!shown && <p className="py-8 text-center text-sm text-muted-foreground">Elige el periodo y pulsa «Generar».</p>}
    </div>
  );
}
