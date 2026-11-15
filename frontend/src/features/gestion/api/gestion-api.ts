import { keepPreviousData, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { downloadBlob } from '@/lib/utils';

/** Endpoints del módulo Gestión (ventas del TPV de Cuiner, solo lectura). */
export const GESTION_BASE = '/v1/gestion';

export type CompareMode = 'previous' | 'year';
export type Bucket = 'day' | 'week' | 'month';
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface DateRange {
  from: string;
  to: string;
}

export interface DashboardKpis {
  total: number;
  base: number;
  tickets: number;
  avgTicket: number;
  voidedTotal: number;
  invitedUnits: number;
  missingAmounts: number;
}

export interface SeriesPoint {
  key: string;
  total: number;
  tickets: number;
  alignedKey?: string;
}

export interface GestionDashboard {
  range: DateRange;
  compare: { mode: CompareMode; range: DateRange };
  bucket: Bucket;
  kpis: DashboardKpis;
  compareKpis: DashboardKpis;
  deltas: Record<keyof DashboardKpis, number | null>;
  series: SeriesPoint[];
  compareSeries: SeriesPoint[];
  topDishes: { key: string; name: string; units: number; total: number }[];
  families: { family: string; total: number; share: number }[];
}

export type GestionColumnKind = 'text' | 'int' | 'qty' | 'euros' | 'percent';
export type GestionCell = string | number | null;

export interface GestionTable {
  key: string;
  title: string;
  subtitle: string;
  columns: { key: string; label: string; kind: GestionColumnKind }[];
  rows: Record<string, GestionCell>[];
  totals?: Record<string, GestionCell>;
  notes: string[];
}

/** Parámetros de un informe; cada informe usa los suyos. */
export type GestionReportParams = Record<string, string | number | undefined>;

export interface TicketSummary {
  id: number;
  date: string;
  lines: number;
  units: number;
  base: number;
  total: number;
  hasVoids: boolean;
}

export interface TicketPage {
  items: TicketSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketDetail {
  id: number;
  date: string;
  base: number;
  total: number;
  lines: {
    line: number;
    name: string;
    type: string;
    units: number;
    base: number | null;
    total: number | null;
    voided: boolean;
    invited: boolean;
  }[];
}

const ROOT = 'gestion';

export function useGestionDashboard(range: DateRange, compare: CompareMode, enabled = true) {
  return useQuery<GestionDashboard, Error>({
    enabled,
    queryKey: [ROOT, 'dashboard', range, compare],
    queryFn: async () =>
      (await apiClient.get(`${GESTION_BASE}/dashboard`, { params: { ...range, compare } })).data,
    placeholderData: keepPreviousData,
  });
}

/** Informe en pantalla; solo pide cuando hay parámetros (tras «Generar»). */
export function useGestionReport(key: string, params: GestionReportParams | null) {
  return useQuery<GestionTable, Error>({
    queryKey: [ROOT, 'report', key, params],
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/reports/${key}`, { params })).data,
    enabled: !!params,
    placeholderData: keepPreviousData,
  });
}

/** Descarga un informe en Excel, CSV o PDF (por apiClient: lleva la sesión). */
export async function downloadGestionReport(key: string, params: GestionReportParams, format: ExportFormat) {
  const response = await apiClient.get<Blob>(`${GESTION_BASE}/reports/${key}/export`, {
    params: { ...params, format },
    responseType: 'blob',
  });
  const disposition = String(response.headers?.['content-disposition'] ?? '');
  // Si el navegador no deja leer la cabecera (CORS), se nombra con las fechas.
  const fallback = [key, params.from, params.to, params.year].filter(Boolean).join('-');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${fallback}.${format}`;
  downloadBlob(name, response.data);
}

export function useGestionTickets(range: DateRange, page: number, pageSize: number, search: string, enabled = true) {
  return useQuery<TicketPage, Error>({
    queryKey: [ROOT, 'tickets', range, page, pageSize, search],
    enabled,
    queryFn: async () =>
      (
        await apiClient.get(`${GESTION_BASE}/tickets`, {
          params: { ...range, page, pageSize, search: search || undefined },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useGestionTicket(id: number | null) {
  return useQuery<TicketDetail, Error>({
    queryKey: [ROOT, 'ticket', id],
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/tickets/${id}`)).data,
    enabled: id !== null,
  });
}

export type MenuClass = 'estrella' | 'caballo' | 'puzzle' | 'perro';

export interface ProfitabilitySummary {
  range: DateRange;
  salesBase: number;
  foodCost: { total: number; pct: number | null; coverage: number | null; unknownDishes: number };
  purchases: { total: number; pct: number | null };
  labor: { total: number; pct: number | null; hours: number; withoutCost: number } | null;
  primeCost: { total: number; pct: number | null } | null;
  menu: Record<MenuClass, number>;
}

export function useGestionProfitability(range: DateRange, enabled = true) {
  return useQuery<ProfitabilitySummary, Error>({
    queryKey: [ROOT, 'profitability', range],
    enabled,
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/profitability`, { params: range })).data,
    placeholderData: keepPreviousData,
  });
}
