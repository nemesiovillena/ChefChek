'use client';

import { ChevronRight } from 'lucide-react';
import type { SalesReport, SalesReportAmounts, SalesReportRow } from '@/lib/cuiner-types';
import { DISH_LEVEL, LEVEL_OPTIONS, formatEuros, formatQty } from '@/lib/cuiner-sales-report-ranges';

// Por debajo de md cada fila se apila como tarjeta de dos columnas; la etiqueta
// de cada dato sale de data-label porque la cabecera se oculta.
const MOBILE_ROW = 'max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-2 max-md:p-3';
const MOBILE_CELL =
  'max-md:block max-md:p-0 max-md:text-left max-md:before:block max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]';
const MOBILE_FULL = 'max-md:col-span-2 max-md:block max-md:p-0';
const NUM = 'px-3 py-2 text-right tabular-nums';

function AmountCells({ amounts, share }: { amounts: SalesReportAmounts; share?: number }) {
  return (
    <>
      <td className={`${NUM} ${MOBILE_CELL}`} data-label="Unidades">
        {formatQty(amounts.units)}
      </td>
      <td className={`${NUM} ${MOBILE_CELL}`} data-label="Invitaciones">
        {amounts.invitedUnits ? formatQty(amounts.invitedUnits) : '—'}
      </td>
      <td className={`${NUM} ${MOBILE_CELL}`} data-label="Sin IVA">
        {formatEuros(amounts.base)}
      </td>
      <td className={`${NUM} ${MOBILE_CELL} font-medium`} data-label="Con IVA">
        {formatEuros(amounts.total)}
      </td>
      <td className={`${NUM} ${MOBILE_CELL}`} data-label="% del periodo">
        {share === undefined ? '' : `${formatQty(share)} %`}
      </td>
    </>
  );
}

/**
 * Tabla del informe de ventas: un bloque por periodo con sus filas y su
 * subtotal, y el total general al final. En familia, subfamilia o sección
 * cada fila se puede pulsar para bajar un nivel dentro de esa familia.
 */
export function CuinerSalesReportTable({
  report,
  onDrillDown,
}: {
  report: SalesReport;
  onDrillDown: (row: SalesReportRow) => void;
}) {
  const level = report.query.level;
  const canDrill = level < DISH_LEVEL;
  const levelName = LEVEL_OPTIONS.find((l) => l.id === level)?.label ?? 'Familia';
  const showPeriodTotals = report.periods.length > 1;

  if (report.periods.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay ventas en este periodo.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm max-md:block">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground max-md:hidden">
          <tr>
            <th className="px-3 py-2">{levelName}</th>
            <th className="px-3 py-2 text-right">Unidades</th>
            <th className="px-3 py-2 text-right">Invitaciones</th>
            <th className="px-3 py-2 text-right">Sin IVA</th>
            <th className="px-3 py-2 text-right">Con IVA</th>
            <th className="px-3 py-2 text-right">%</th>
          </tr>
        </thead>
        {report.periods.map((period) => (
          <tbody key={period.key} className="divide-y divide-border border-b border-border max-md:block">
            <tr className="bg-primary/5 max-md:block">
              <td colSpan={6} className="px-3 py-2 font-semibold max-md:block">
                {period.label}
              </td>
            </tr>
            {period.rows.map((row) => (
              <tr key={row.key} className={MOBILE_ROW}>
                <td className={`px-3 py-2 ${MOBILE_FULL}`}>
                  {canDrill ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left font-medium text-primary hover:underline"
                      onClick={() => onDrillDown(row)}
                      title="Ver el detalle de esta familia"
                    >
                      {row.label}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  ) : (
                    <>
                      <span className="font-medium">{row.label}</span>
                      {row.family && <span className="block text-xs text-muted-foreground">{row.family}</span>}
                    </>
                  )}
                </td>
                <AmountCells amounts={row} share={row.share} />
              </tr>
            ))}
            {showPeriodTotals && (
              <tr className={`bg-muted/50 font-semibold ${MOBILE_ROW}`}>
                <td className={`px-3 py-2 ${MOBILE_FULL}`}>Total {period.label}</td>
                <AmountCells amounts={period.totals} />
              </tr>
            )}
          </tbody>
        ))}
        <tfoot className="max-md:block">
          <tr className={`bg-muted font-bold ${MOBILE_ROW}`}>
            <td className={`px-3 py-2 ${MOBILE_FULL}`}>TOTAL</td>
            <AmountCells amounts={report.totals} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
