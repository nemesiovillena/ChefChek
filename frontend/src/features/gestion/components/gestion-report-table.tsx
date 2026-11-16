import type { GestionTable } from '../api/gestion-api';
import { formatCell } from '../gestion-format';

/**
 * Tabla de un informe de Gestión. En escritorio, tabla; en móvil cada fila es
 * una tarjeta con «columna: valor» (convención del proyecto para tablas anchas).
 */
export function GestionReportTable({ table }: { table: GestionTable }) {
  const rows = table.totals ? [...table.rows, table.totals] : table.rows;
  const isTotal = (i: number) => !!table.totals && i === rows.length - 1;
  const align = (kind: string) => (kind === 'text' ? 'text-left' : 'text-right');

  if (table.rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">Sin datos en este periodo.</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              {table.columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${align(c.kind)}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--outline-variant)] last:border-0 ${
                  isTotal(i) ? 'font-semibold' : ''
                }`}
              >
                {table.columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 tabular-nums text-[var(--on-surface)] ${align(c.kind)}`}>
                    {formatCell(c.kind, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((r, i) => (
          <li
            key={i}
            className={`rounded-lg border border-[var(--outline-variant)] p-3 text-sm ${isTotal(i) ? 'font-semibold' : ''}`}
          >
            {table.columns.map((c) => (
              <div key={c.key} className="flex justify-between gap-3 py-0.5">
                <span className="text-[var(--on-surface-variant)]">{c.label}</span>
                <span className="text-right tabular-nums text-[var(--on-surface)]">{formatCell(c.kind, r[c.key])}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      {table.notes.map((n) => (
        <p key={n} className="mt-3 text-xs text-[var(--on-surface-variant)]">
          {n}
        </p>
      ))}
    </>
  );
}
