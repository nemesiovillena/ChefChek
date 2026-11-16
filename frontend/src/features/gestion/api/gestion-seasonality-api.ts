import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { GESTION_BASE } from './gestion-api';

export type CalendarDateKind = 'nacional' | 'autonomico' | 'local' | 'comercial' | 'propio';

export const KIND_LABEL: Record<CalendarDateKind, string> = {
  nacional: 'Festivo nacional',
  autonomico: 'Festivo autonómico',
  local: 'Local',
  comercial: 'Fecha comercial',
  propio: 'Propia del local',
};

export interface SeasonDay {
  date: string;
  dow: number;
  total: number;
  tickets: number;
}

export interface SeasonHoliday {
  id: string;
  date: string;
  name: string;
  kind: CalendarDateKind;
  weekday: string;
  total: number;
  tickets: number;
  open: boolean;
  normalAvg: number | null;
  deltaPct: number | null;
}

export interface Seasonality {
  year: number;
  days: SeasonDay[];
  topDays: (SeasonDay & { weekday: string; special: string[] })[];
  byWeekday: { weekday: string; daysWithSales: number; avgTotal: number }[];
  weeks: { week: number; years: number; avgTotal: number; bestTotal: number }[];
  holidays: SeasonHoliday[];
}

const KEY = ['gestion', 'seasonality'];

export function useGestionSeasonality(year: number) {
  return useQuery<Seasonality, Error>({
    queryKey: [...KEY, year],
    queryFn: async () => (await apiClient.get(`${GESTION_BASE}/seasonality`, { params: { year } })).data,
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useSeedCalendarDates() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { year: number; region: 'nacional' | 'villena' }) =>
      (await apiClient.post(`${GESTION_BASE}/calendar-dates/seed`, input)).data as { added: number },
    onSuccess: invalidate,
  });
}

export function useCreateCalendarDate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { date: string; name: string; kind: CalendarDateKind }) =>
      (await apiClient.post(`${GESTION_BASE}/calendar-dates`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCalendarDate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`${GESTION_BASE}/calendar-dates/${id}`)).data,
    onSuccess: invalidate,
  });
}
