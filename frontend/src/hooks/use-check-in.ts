'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import { isNetworkError, loadSnapshot, saveSnapshot } from '@/lib/check-in-offline';
import type {
  InspectionLink,
  InspectionLinkInput,
  IntegrityResult,
  ReportFormat,
  Adjustment,
  AdjustmentInput,
  ApprovedTimesheet,
  MonthState,
  TimesheetRow,
  CheckInReadiness,
  CheckInSettings,
  CheckInSettingsResponse,
  Employee,
  EmployeeInput,
  LegalTextKind,
  LegalTextState,
  LegalTextVersion,
  KioskState,
  LinkableUser,
  OwnCheckInState,
  PresenceEntry,
  PunchInput,
  PunchView,
  ReviewPunch,
  WorkCenter,
  WorkCenterGeofenceInput,
} from '@/lib/check-in-types';

const BASE = '/v1/check-in';

const KEYS = {
  employees: ['check-in', 'employees'],
  linkableUsers: ['check-in', 'linkable-users'],
  settings: ['check-in', 'settings'],
  workCenters: ['check-in', 'work-centers'],
  legalTexts: ['check-in', 'legal-texts'],
  readiness: ['check-in', 'readiness'],
  me: ['check-in', 'me'],
  kiosk: ['check-in', 'kiosk'],
  presence: ['check-in', 'presence'],
  review: ['check-in', 'review'],
  month: ['check-in', 'month'],
  adjustments: ['check-in', 'adjustments'],
  timesheets: ['check-in', 'timesheets'],
  inspectionLinks: ['check-in', 'inspection-links'],
};

// El interceptor de apiClient desenvuelve { success, data }: `.data` ya es la entidad.

// ─────────────────────────────────────────────────────────── Empleados

export function useEmployees(includeInactive: boolean) {
  return useApiQuery<Employee[]>(
    [...KEYS.employees, includeInactive ? 'all' : 'active'],
    `${BASE}/employees?includeInactive=${includeInactive}`,
  );
}

export function useLinkableUsers() {
  return useApiQuery<LinkableUser[]>(KEYS.linkableUsers, `${BASE}/employees/linkable-users`);
}

function useInvalidateEmployees() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.employees });
    qc.invalidateQueries({ queryKey: KEYS.linkableUsers });
  };
}

export function useCreateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation<Employee, Error, EmployeeInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/employees`, data)).data,
    onSuccess: invalidate,
  });
}

/** Crea fichas a partir de cuentas del equipo (nombre y puesto ya conocidos). */
export function useImportEmployees() {
  const invalidate = useInvalidateEmployees();
  return useMutation<Employee[], Error, string[]>({
    mutationFn: async (userIds) =>
      (await apiClient.post(`${BASE}/employees/import-from-users`, { userIds })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation<Employee, Error, { id: string; data: Partial<EmployeeInput> }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE}/employees/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useSetEmployeePin() {
  const invalidate = useInvalidateEmployees();
  return useMutation<void, Error, { id: string; pin: string }>({
    mutationFn: async ({ id, pin }) => {
      await apiClient.put(`${BASE}/employees/${id}/pin`, { pin });
    },
    onSuccess: invalidate,
  });
}

export function useClearEmployeePin() {
  const invalidate = useInvalidateEmployees();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/employees/${id}/pin`);
    },
    onSuccess: invalidate,
  });
}

// ──────────────────────────────────────────────────── Convenio y jornada

export function useCheckInSettings() {
  return useApiQuery<CheckInSettingsResponse>(KEYS.settings, `${BASE}/settings`);
}

export function useUpdateCheckInSettings() {
  const qc = useQueryClient();
  return useMutation<CheckInSettings, Error, Partial<CheckInSettings>>({
    mutationFn: async (data) => (await apiClient.patch(`${BASE}/settings`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.settings });
      // Los ajustes cambian los botones y bloques de la pantalla de fichar.
      qc.invalidateQueries({ queryKey: KEYS.me });
    },
  });
}

export function useApplyAgreementPreset() {
  const qc = useQueryClient();
  return useMutation<CheckInSettings, Error, string>({
    mutationFn: async (agreementKey) =>
      (await apiClient.post(`${BASE}/settings/agreement`, { agreementKey })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.settings }),
  });
}

// ──────────────────────────────────────────────────── Centros de trabajo

export function useWorkCenters() {
  return useApiQuery<WorkCenter[]>(KEYS.workCenters, `${BASE}/work-centers`);
}

export function useCreateWorkCenter() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { name: string; address?: string }>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/work-centers`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

export function useUpdateWorkCenter() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { id: string; data: { name?: string; address?: string; isActive?: boolean } }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE}/work-centers/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

export function useUpdateWorkCenterGeofence() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { id: string; data: WorkCenterGeofenceInput }>({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE}/work-centers/${id}/geofence`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

// ──────────────────────────────────────────────────────── Textos legales

export function useLegalTexts() {
  return useApiQuery<LegalTextState[]>(KEYS.legalTexts, `${BASE}/legal-texts`);
}

function useInvalidateLegalTexts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.legalTexts });
    qc.invalidateQueries({ queryKey: KEYS.readiness });
  };
}

export function useSaveLegalText() {
  const invalidate = useInvalidateLegalTexts();
  return useMutation<LegalTextVersion, Error, { kind: LegalTextKind; content: string }>({
    mutationFn: async ({ kind, content }) =>
      (await apiClient.put(`${BASE}/legal-texts/${kind}`, { content })).data,
    onSuccess: invalidate,
  });
}

export function useValidateLegalText() {
  const invalidate = useInvalidateLegalTexts();
  return useMutation<LegalTextVersion, Error, LegalTextKind>({
    mutationFn: async (kind) => (await apiClient.post(`${BASE}/legal-texts/${kind}/validate`)).data,
    onSuccess: invalidate,
  });
}

/** ¿Están validados los textos legales? Sin eso no se puede fichar. */
export function useCheckInReadiness() {
  return useApiQuery<CheckInReadiness>(KEYS.readiness, `${BASE}/readiness`);
}

// ─────────────────────────────────────────────────────────────── Fichaje

export const CHECK_IN_KEYS = KEYS;

/**
 * Tiempo máximo de espera al servidor en las pantallas de fichaje. Con mala
 * cobertura el navegador dice que hay red pero las peticiones no llegan: sin
 * este límite la persona se quedaría mirando un "cargando". Al vencer, se
 * trata igual que estar sin conexión (copia local / cola de pendientes).
 */
const PUNCH_TIMEOUT_MS = 8000;

/**
 * Consulta que, si no hay red, devuelve la última copia guardada en el
 * dispositivo marcada con `offline: true`. Así las pantallas de fichaje
 * siguen funcionando sin conexión.
 */
async function fetchWithSnapshot<T extends object>(url: string, snapshotName: string): Promise<T> {
  try {
    const data = (await apiClient.get<T>(url, { timeout: PUNCH_TIMEOUT_MS })).data;
    saveSnapshot(snapshotName, data);
    return data;
  } catch (error) {
    if (isNetworkError(error)) {
      const snapshot = loadSnapshot<T>(snapshotName);
      if (snapshot) return { ...snapshot, offline: true };
    }
    throw error;
  }
}

/** Estado de la cuenta personal: situación, últimos fichajes y textos por leer. */
export function useOwnCheckIn(userId: string | undefined) {
  return useQuery<OwnCheckInState, Error>({
    queryKey: KEYS.me,
    queryFn: () => fetchWithSnapshot<OwnCheckInState>(`${BASE}/me`, `me.${userId}`),
    enabled: !!userId,
    // Sin red no tiene sentido reintentar: se usa la copia guardada.
    retry: false,
    networkMode: 'always',
  });
}

export function useAckOwnLegalTexts() {
  const qc = useQueryClient();
  return useMutation<{ acknowledged: number }, Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE}/me/legal-acks`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.me }),
  });
}

export function useRecordPunch() {
  const qc = useQueryClient();
  return useMutation<PunchView, unknown, PunchInput>({
    mutationFn: async (data) =>
      (await apiClient.post(`${BASE}/punches`, data, { timeout: PUNCH_TIMEOUT_MS })).data,
    networkMode: 'always',
    // También al fallar: un 409 de secuencia significa que el estado en pantalla estaba viejo.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.me });
      qc.invalidateQueries({ queryKey: KEYS.kiosk });
      qc.invalidateQueries({ queryKey: KEYS.presence });
    },
  });
}

/** Pantalla de kiosco de un centro. Sin `locationId` devuelve solo los centros. */
export function useKioskState(locationId: string | null) {
  return useQuery<KioskState, Error>({
    queryKey: [...KEYS.kiosk, locationId ?? 'none'],
    queryFn: () =>
      fetchWithSnapshot<KioskState>(
        `${BASE}/kiosk${locationId ? `?locationId=${locationId}` : ''}`,
        `kiosk.${locationId ?? 'none'}`,
      ),
    refetchInterval: 60_000,
    retry: false,
    networkMode: 'always',
  });
}

/** Quién está trabajando ahora. Se refresca solo cada 30 s. */
export function usePresence(enabled: boolean) {
  return useApiQuery<PresenceEntry[]>(KEYS.presence, `${BASE}/presence`, {
    enabled,
    refetchInterval: 30_000,
  });
}

/** Fichajes marcados para revisión (PIN sin verificar, secuencia, reloj…). */
export function usePunchesForReview() {
  return useApiQuery<ReviewPunch[]>(KEYS.review, `${BASE}/punches/review`, { refetchInterval: 60_000 });
}

// ──────────────────────────────────────────── Jornadas, correcciones y hojas

/** Mes propio: jornadas, totales, hoja aprobada y conformidad. */
export function useOwnMonth(year: number, month: number, enabled = true) {
  return useApiQuery<MonthState>(
    [...KEYS.month, 'me', String(year), String(month)],
    `${BASE}/me/timesheet?year=${year}&month=${month}`,
    { enabled },
  );
}

/** Mes de una persona (gerencia). */
export function useEmployeeMonth(employeeId: string | null, year: number, month: number) {
  return useApiQuery<MonthState>(
    [...KEYS.month, employeeId ?? 'none', String(year), String(month)],
    `${BASE}/timesheets/employee?employeeId=${employeeId}&year=${year}&month=${month}`,
    { enabled: !!employeeId },
  );
}

/** Una corrección o una aprobación cambian jornadas, hojas, pendientes y situación. */
function useInvalidateWorkdays() {
  const qc = useQueryClient();
  return () => {
    for (const key of [KEYS.month, KEYS.adjustments, KEYS.timesheets, KEYS.review, KEYS.me, KEYS.presence]) {
      qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useOwnAdjustments() {
  return useApiQuery<Adjustment[]>([...KEYS.adjustments, 'me'], `${BASE}/me/adjustments`);
}

export function usePendingAdjustments() {
  return useApiQuery<Adjustment[]>([...KEYS.adjustments, 'pending'], `${BASE}/adjustments?pending=true`, {
    refetchInterval: 60_000,
  });
}

/** El empleado solicita una corrección de lo suyo: queda pendiente. */
export function useRequestAdjustment() {
  const invalidate = useInvalidateWorkdays();
  return useMutation<Adjustment, Error, AdjustmentInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/me/adjustments`, data)).data,
    onSuccess: invalidate,
  });
}

/** Gerencia corrige directamente: queda aprobada, con su motivo. */
export function useCreateAdjustment() {
  const invalidate = useInvalidateWorkdays();
  return useMutation<Adjustment, Error, AdjustmentInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/adjustments`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDecideAdjustment() {
  const invalidate = useInvalidateWorkdays();
  return useMutation<Adjustment, Error, { id: string; approve: boolean; note?: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE}/adjustments/${id}/decision`, data)).data,
    onSuccess: invalidate,
  });
}

export function useTimesheets(year: number, month: number) {
  return useApiQuery<TimesheetRow[]>(
    [...KEYS.timesheets, String(year), String(month)],
    `${BASE}/timesheets?year=${year}&month=${month}`,
  );
}

export function useApproveTimesheet() {
  const invalidate = useInvalidateWorkdays();
  return useMutation<ApprovedTimesheet, Error, { employeeId: string; year: number; month: number; reopenReason?: string }>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/timesheets/approve`, data)).data,
    onSuccess: invalidate,
  });
}

export function useAckOwnTimesheet() {
  const invalidate = useInvalidateWorkdays();
  return useMutation<{ acknowledgedAt: string | null }, Error, { year: number; month: number }>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/me/timesheet/ack`, data)).data,
    onSuccess: invalidate,
  });
}

// ───────────────────────────────────────────────── Informes e inspección

/**
 * Descarga el registro de jornada de un mes. Va por apiClient (lleva la
 * sesión) y se guarda desde un blob; el nombre lo fija el servidor.
 */
export async function downloadWorkdayReport(params: {
  year: number;
  month: number;
  format: ReportFormat;
  employeeId?: string;
}) {
  const response = await apiClient.get<Blob>(`${BASE}/reports/workdays`, { params, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `registro-jornada.${params.format}`;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Margen para que el navegador empiece la descarga antes de liberar el blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Comprobación bajo demanda de la cadena de huellas de los fichajes. */
export function useVerifyIntegrity() {
  return useMutation<IntegrityResult, Error, void>({
    mutationFn: async () => (await apiClient.get(`${BASE}/reports/integrity`)).data,
  });
}

export function useInspectionLinks() {
  return useApiQuery<InspectionLink[]>(KEYS.inspectionLinks, `${BASE}/inspection-links`);
}

export function useCreateInspectionLink() {
  const qc = useQueryClient();
  return useMutation<InspectionLink, Error, InspectionLinkInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/inspection-links`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inspectionLinks }),
  });
}

export function useRevokeInspectionLink() {
  const qc = useQueryClient();
  return useMutation<InspectionLink, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE}/inspection-links/${id}/revoke`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.inspectionLinks }),
  });
}
