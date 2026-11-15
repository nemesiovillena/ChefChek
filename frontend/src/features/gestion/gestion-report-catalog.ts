/**
 * Informes de Gestión que se ven en el catálogo. `ventas` reutiliza el informe
 * por familias que ya tenía Cuiner; el resto usan la tabla común de Gestión.
 */
export type ReportOption = { value: string; label: string };

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  /** range = periodo de fechas; years = año final y nº de años. */
  input: 'range' | 'years';
  /** Selectores extra del informe (clave del parámetro → opciones). */
  options?: { param: string; label: string; choices: ReportOption[]; initial: string }[];
}

export const GESTION_REPORTS: ReportDefinition[] = [
  {
    key: 'ventas',
    title: 'Ventas por periodo y familia',
    description: 'Por día, semana, mes o año; de familia a plato, con unidades, base y total.',
    icon: 'stacked_bar_chart',
    input: 'range',
  },
  {
    key: 'ranking',
    title: 'Ranking de platos',
    description: 'Los más y los menos vendidos, por importe o por unidades.',
    icon: 'leaderboard',
    input: 'range',
    options: [
      {
        param: 'order',
        label: 'Orden',
        initial: 'desc',
        choices: [
          { value: 'desc', label: 'Más vendidos' },
          { value: 'asc', label: 'Menos vendidos' },
        ],
      },
      {
        param: 'by',
        label: 'Por',
        initial: 'total',
        choices: [
          { value: 'total', label: 'Importe' },
          { value: 'units', label: 'Unidades' },
        ],
      },
      {
        param: 'limit',
        label: 'Cuántos',
        initial: '50',
        choices: ['10', '25', '50', '100', '500'].map((v) => ({ value: v, label: v })),
      },
    ],
  },
  {
    key: 'interanual',
    title: 'Comparativa interanual',
    description: 'Ventas mes a mes de varios años, con la variación del último.',
    icon: 'compare_arrows',
    input: 'years',
  },
  {
    key: 'anulaciones',
    title: 'Anulaciones e invitaciones',
    description: 'Lo anulado y lo invitado, por día o por plato.',
    icon: 'block',
    input: 'range',
    options: [
      {
        param: 'groupBy',
        label: 'Agrupar',
        initial: 'day',
        choices: [
          { value: 'day', label: 'Por día' },
          { value: 'dish', label: 'Por plato' },
        ],
      },
    ],
  },
  {
    key: 'iva',
    title: 'IVA repercutido',
    description: 'Base imponible y cuota por tipo de IVA.',
    icon: 'percent',
    input: 'range',
    options: [
      {
        param: 'groupBy',
        label: 'Agrupar',
        initial: 'month',
        choices: [
          { value: 'month', label: 'Por mes' },
          { value: 'day', label: 'Por día' },
          { value: 'total', label: 'Total del periodo' },
        ],
      },
    ],
  },
];

export const findReport = (key: string) => GESTION_REPORTS.find((r) => r.key === key);
