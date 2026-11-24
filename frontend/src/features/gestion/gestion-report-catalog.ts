import { ArrowLeftRight, Ban, Banknote, ChartColumnStacked, ChefHat, Clock, ConciergeBell, IdCard, Landmark, LayoutGrid, ListOrdered, Percent, Truck, Wallet, type LucideIcon } from 'lucide-react';

/**
 * Informes de Gestión que se ven en el catálogo. `ventas` reutiliza el informe
 * por familias que ya tenía Cuiner; el resto usan la tabla común de Gestión.
 */
export type ReportOption = { value: string; label: string };

export interface ReportDefinition {
  key: string;
  /** Grupo del catálogo. */
  group: 'Ventas' | 'Caja y sala' | 'Rentabilidad' | 'Resultados';
  title: string;
  description: string;
  icon: LucideIcon;
  /** range = periodo de fechas; years = año final y nº de años; year = un año. */
  input: 'range' | 'years' | 'year';
  /** Selectores extra del informe (clave del parámetro → opciones). */
  options?: { param: string; label: string; choices: ReportOption[]; initial: string }[];
}

export const GESTION_REPORTS: ReportDefinition[] = [
  {
    group: 'Ventas',
    key: 'ventas',
    title: 'Ventas por periodo y familia',
    description: 'Por día, semana, mes o año; de familia a plato, con unidades, base y total.',
    icon: ChartColumnStacked,
    input: 'range',
  },
  {
    group: 'Ventas',
    key: 'ranking',
    title: 'Ranking de platos',
    description: 'Los más y los menos vendidos, por importe o por unidades.',
    icon: ListOrdered,
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
    group: 'Ventas',
    key: 'interanual',
    title: 'Comparativa interanual',
    description: 'Ventas mes a mes de varios años, con la variación del último.',
    icon: ArrowLeftRight,
    input: 'years',
  },
  {
    group: 'Ventas',
    key: 'anulaciones',
    title: 'Anulaciones e invitaciones',
    description: 'Lo anulado y lo invitado, por día o por plato.',
    icon: Ban,
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
    group: 'Ventas',
    key: 'iva',
    title: 'IVA repercutido',
    description: 'Base imponible y cuota por tipo de IVA.',
    icon: Percent,
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
  {
    group: 'Caja y sala',
    key: 'caja-diaria',
    title: 'Caja diaria',
    description: 'Cada día: tickets, comensales, gasto por comensal, comidas y cenas, y cobros por forma de pago.',
    icon: Banknote,
    input: 'range',
  },
  {
    group: 'Caja y sala',
    key: 'franjas-horarias',
    title: 'Franjas horarias',
    description: 'Ventas por hora de apertura de la mesa y día de la semana.',
    icon: Clock,
    input: 'range',
  },
  {
    group: 'Caja y sala',
    key: 'camareros',
    title: 'Camareros',
    description: 'Tickets, comensales, ventas, ticket medio y gasto por comensal de cada camarero.',
    icon: ConciergeBell,
    input: 'range',
  },
  {
    group: 'Rentabilidad',
    key: 'food-cost',
    title: 'Food cost teórico',
    description: 'Coste de escandallo de lo servido, plato a plato, frente a lo vendido.',
    icon: ChefHat,
    input: 'range',
  },
  {
    group: 'Rentabilidad',
    key: 'compras',
    title: 'Compras',
    description: 'Albaranes recibidos por proveedor o categoría, y su peso sobre las ventas.',
    icon: Truck,
    input: 'range',
    options: [
      {
        param: 'groupBy',
        label: 'Agrupar',
        initial: 'supplier',
        choices: [
          { value: 'supplier', label: 'Por proveedor' },
          { value: 'category', label: 'Por categoría' },
        ],
      },
    ],
  },
  {
    group: 'Rentabilidad',
    key: 'ingenieria-menu',
    title: 'Ingeniería de menú',
    description: 'Estrellas, percherones, puzzles y perros: popularidad × margen de cada plato.',
    icon: LayoutGrid,
    input: 'range',
  },
  {
    group: 'Rentabilidad',
    key: 'personal',
    title: 'Coste de personal',
    description: 'Horas fichadas × coste/hora de cada persona (hasta un año).',
    icon: IdCard,
    input: 'range',
  },
  {
    group: 'Resultados',
    key: 'cuenta-explotacion',
    title: 'Cuenta de explotación',
    description: 'Ventas, compras, personal, gastos generales y EBITDA mes a mes.',
    icon: Landmark,
    input: 'year',
  },
  {
    group: 'Resultados',
    key: 'flujo-caja',
    title: 'Flujo de caja aproximado',
    description: 'Cobros y pagos con IVA por mes y saldo acumulado.',
    icon: Wallet,
    input: 'year',
  },
];

export const REPORT_GROUPS = ['Ventas', 'Caja y sala', 'Rentabilidad', 'Resultados'] as const;

export const findReport = (key: string) => GESTION_REPORTS.find((r) => r.key === key);
