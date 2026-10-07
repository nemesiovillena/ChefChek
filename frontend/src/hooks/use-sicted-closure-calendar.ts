'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

const BASE_URL = '/v1/sicted/checklists';
const CALENDAR_KEY = 'sicted-closure-calendar';

export type CalendarExceptionKind = 'CLOSED' | 'OPEN';

export interface CalendarException {
  id: string;
  kind: CalendarExceptionKind;
  /** Día natural 'YYYY-MM-DD'. */
  fromDay: string;
  toDay: string;
  reason: string | null;
  createdByName: string;
  createdAt: string;
}

export interface ClosureCalendar {
  /** 0=domingo..6=sábado. */
  closedWeekdays: number[];
  exceptions: CalendarException[];
  /** Hojas vencidas sin justificar que caen en días de cierre. */
  overdueOnClosedDays: number;
}

export interface CalendarExceptionInput {
  kind: CalendarExceptionKind;
  fromDay: string;
  toDay: string;
  reason?: string;
}

/** Días de cierre del local: en ellos no se generan ni se esperan hojas. */
export function useSictedClosureCalendar(enabled = true) {
  return useQuery<ClosureCalendar, Error>({
    queryKey: [CALENDAR_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/closure-calendar`)).data,
    enabled,
  });
}

/**
 * El calendario cambia qué hojas se esperan y cuáles salen como vencidas:
 * tras tocarlo se refresca todo lo de SICTED, no solo el propio calendario.
 */
function useInvalidateSicted() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith('sicted-'),
    });
}

export function useSetSictedClosedWeekdays() {
  const invalidate = useInvalidateSicted();
  return useMutation<ClosureCalendar, Error, number[]>({
    mutationFn: async (closedWeekdays) =>
      (await apiClient.put(`${BASE_URL}/closure-calendar/weekdays`, { closedWeekdays })).data,
    onSuccess: invalidate,
  });
}

export function useAddSictedCalendarException() {
  const invalidate = useInvalidateSicted();
  return useMutation<ClosureCalendar, Error, CalendarExceptionInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/closure-calendar/exceptions`, data)).data,
    onSuccess: invalidate,
  });
}

export function useRemoveSictedCalendarException() {
  const invalidate = useInvalidateSicted();
  return useMutation<ClosureCalendar, Error, string>({
    mutationFn: async (id) => (await apiClient.delete(`${BASE_URL}/closure-calendar/exceptions/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useJustifySictedClosedDayRuns() {
  const invalidate = useInvalidateSicted();
  return useMutation<{ justified: number }, Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE_URL}/runs/justify-closed-days`, {})).data,
    onSuccess: invalidate,
  });
}
