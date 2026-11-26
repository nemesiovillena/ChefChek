import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { GESTION_BASE } from './gestion-api';

export type ExpenseCategory =
  | 'alquiler'
  | 'suministros'
  | 'seguros'
  | 'gestoria'
  | 'marketing'
  | 'mantenimiento'
  | 'limpieza'
  | 'bancos'
  | 'tributos'
  | 'otros'
  | 'personal'
  | 'financieros';

/** En el orden del balance del gestor (cuentas 621 a 669). */
export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  alquiler: 'Alquiler y licencias',
  mantenimiento: 'Reparaciones y mantenimiento',
  gestoria: 'Gestoría y profesionales',
  seguros: 'Seguros',
  bancos: 'Comisiones bancarias y de tarjeta',
  marketing: 'Publicidad y marketing',
  suministros: 'Suministros (luz, agua, gas, teléfono)',
  limpieza: 'Limpieza y mantelería',
  otros: 'Otros servicios',
  tributos: 'Tributos (basuras, IAE…)',
  personal: 'Personal: nóminas + Seguridad Social',
  financieros: 'Gastos financieros (intereses)',
};

/** Ayuda bajo el selector para las categorías que no son gastos generales. */
export const EXPENSE_HINT: Partial<Record<ExpenseCategory, string>> = {
  personal: 'El mes que la tenga, sustituye a la estimación por horas fichadas.',
  financieros: 'Va por debajo del EBITDA: resta en el resultado, no en el EBITDA.',
};

export interface ResultsMonth {
  month: string;
  label: string;
  sales: number;
  salesWithVat: number;
  purchases: number;
  purchasesWithVat: number;
  grossMargin: number;
  labor: number;
  /** real = nóminas + SS introducidas; fichajes = horas × coste/hora. */
  laborSource: 'real' | 'fichajes';
  overheads: number;
  ebitda: number;
  ebitdaPct: number | null;
  financial: number;
  result: number;
  resultPct: number | null;
  openDays: number;
}

export interface GestionResults {
  year: number;
  months: ResultsMonth[];
  totals: Omit<ResultsMonth, 'month' | 'label' | 'laborSource'> & { realLaborMonths: number };
  breakEven: { monthly: number | null; daily: number | null; variablePct: number | null };
  warnings: {
    laborWithoutCost: number;
    monthsWithoutOverheads: number;
    monthsWithoutPurchases: number;
    unconfirmedAlbaranes: number;
    laborUnavailable: boolean;
  };
}

export interface Expense {
  id: string;
  month: string;
  category: ExpenseCategory;
  concept: string;
  amount: number;
}

const ROOT = ['gestion', 'results'];

export function useGestionResults(year: number) {
  return useQuery<GestionResults, Error>({
    queryKey: [...ROOT, 'summary', year],
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/results`, { params: { year } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useGestionExpenses(year: number) {
  return useQuery<Expense[], Error>({
    queryKey: [...ROOT, 'expenses', year],
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/expenses`, { params: { year } })).data,
    placeholderData: keepPreviousData,
  });
}

/** Cualquier cambio de gastos recalcula la cuenta de explotación y los informes (exportables). */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gestion'] });
}

export function useCreateExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: Omit<Expense, 'id'>) => (await apiClient.post(`${GESTION_BASE}/expenses`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`${GESTION_BASE}/expenses/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useCopyExpenses() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { from: string; to: string }) =>
      (await apiClient.post(`${GESTION_BASE}/expenses/copy`, input)).data as { copied: number },
    onSuccess: invalidate,
  });
}

// ───────────────────────────────────────── Balance de explotación del gestor

/** Dónde va cada cuenta del balance: un gasto, ventas/compras (para cuadrar) o nada. */
export type BalanceTarget = ExpenseCategory | 'ventas' | 'compras' | 'ignorar';

export const BALANCE_TARGET_LABEL: Record<BalanceTarget, string> = {
  ...EXPENSE_LABEL,
  ventas: 'Ventas (solo para cuadrar)',
  compras: 'Compras (solo para cuadrar)',
  ignorar: 'No importar',
};

/** amount > 0 resta al beneficio (gasto); < 0 suma (ingreso, rappel). */
export interface BalanceAccountLine {
  code: string;
  name: string;
  amount: number;
  target: BalanceTarget;
}

export interface BalanceTotals {
  sales: number;
  purchases: number;
  labor: number;
  overheads: number;
  financial: number;
  result: number;
}

export interface BalancePeriod {
  from: string;
  to: string;
  accounts: BalanceAccountLine[];
  totals: BalanceTotals;
}

export interface BalanceExtraction {
  company: string | null;
  periods: BalancePeriod[];
}

// La IA lee 2–3 páginas; el servidor corta a ~170 s.
const BALANCE_EXTRACT_TIMEOUT_MS = 180_000;

/** Lee el balance del gestor con IA. No guarda nada. */
export function useExtractBalance() {
  return useMutation<BalanceExtraction, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return (await apiClient.post(`${GESTION_BASE}/expenses/balance/extract`, formData, { timeout: BALANCE_EXTRACT_TIMEOUT_MS })).data;
    },
  });
}

export function useApplyBalance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { from: string; to: string; fileName?: string; accounts: BalanceAccountLine[]; replaceExisting?: boolean }) =>
      (await apiClient.post(`${GESTION_BASE}/expenses/balance/apply`, input)).data as { months: number; expenses: number; replaced: number },
    onSuccess: invalidate,
  });
}

const EXPENSE_KEYS = Object.keys(EXPENSE_LABEL) as ExpenseCategory[];

/** Los mismos totales que calcula el servidor, para ver al momento el efecto de cambiar una categoría. */
export function balanceTotals(lines: BalanceAccountLine[]): BalanceTotals {
  const round = (n: number) => Math.round(n * 100) / 100;
  const sum = (pick: (t: BalanceTarget) => boolean) => lines.filter((l) => pick(l.target)).reduce((n, l) => n + l.amount, 0);
  return {
    sales: round(-sum((t) => t === 'ventas')),
    purchases: round(sum((t) => t === 'compras')),
    labor: round(sum((t) => t === 'personal')),
    overheads: round(sum((t) => EXPENSE_KEYS.includes(t as ExpenseCategory) && t !== 'personal' && t !== 'financieros')),
    financial: round(sum((t) => t === 'financieros')),
    result: round(-lines.reduce((n, l) => n + l.amount, 0)),
  };
}
