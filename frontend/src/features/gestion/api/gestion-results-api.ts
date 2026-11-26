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
