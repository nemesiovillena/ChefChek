'use client';

import { Suspense, useState } from 'react';
import { CalendarDays, ClipboardCheck, Inbox, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useEmployeeMonth, useEmployees, useOwnAdjustments, useOwnCheckIn, useOwnMonth, usePendingAdjustments } from '@/hooks/use-check-in';
import { useTabQueryParam } from '@/hooks/use-tab-query-param';
import { canManageCheckIn, cardCls, inputCls } from '../components/check-in-form-styles';
import { CheckInMonthPicker, currentYearMonth, type YearMonth } from '../components/check-in-month-picker';
import { CheckInMonthView } from '../components/check-in-month-view';
import { CheckInRequestsTab, describeAdjustment } from '../components/check-in-requests-tab';
import { CheckInTimesheetsTab } from '../components/check-in-timesheets-tab';

export const dynamic = 'force-dynamic';

type TabId = 'mias' | 'equipo' | 'solicitudes' | 'hojas';
const TAB_IDS: readonly TabId[] = ['mias', 'equipo', 'solicitudes', 'hojas'];

/** Mis jornadas del mes y el estado de mis solicitudes. */
function OwnTab({ period }: { period: YearMonth }) {
  const { user } = useAuth();
  const { data: own } = useOwnCheckIn(user?.id);
  const hasEmployee = !!own?.employee;
  const { data: state, isLoading } = useOwnMonth(period.year, period.month, hasEmployee);
  const { data: adjustments } = useOwnAdjustments();

  if (own && !hasEmployee) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Tu cuenta no está vinculada a una ficha de empleado</p>
        <p className="text-sm text-[var(--on-surface-variant)]">Por eso no tienes jornadas propias que mostrar.</p>
      </div>
    );
  }
  if (isLoading || !state) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  const recent = (adjustments ?? []).slice(0, 8);
  return (
    <div className="space-y-4">
      <CheckInMonthView state={state} mode="own" showAddMissingDay={own?.display?.showAddMissingDay !== false} />
      {own?.display?.showOwnAdjustments !== false && recent.length > 0 && (
        <div className={cardCls}>
          <p className="mb-2 font-medium">Mis solicitudes de corrección</p>
          <ul className="divide-y divide-[var(--outline-variant)]">
            {recent.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <p>
                  {describeAdjustment(a)} ·{' '}
                  <span
                    className={
                      a.decision?.status === 'REJECTED'
                        ? 'text-[var(--error)]'
                        : a.decision
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--on-surface-variant)]'
                    }
                  >
                    {a.decision ? (a.decision.status === 'APPROVED' ? 'aprobada' : 'rechazada') : 'pendiente'}
                  </span>
                </p>
                <p className="text-[var(--on-surface-variant)]">
                  Motivo: {a.reason}
                  {a.decision?.note && ` · Respuesta: ${a.decision.note}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Jornadas de una persona del equipo, con corrección directa. */
function TeamTab({ period, employeeId, onSelect }: { period: YearMonth; employeeId: string | null; onSelect: (id: string) => void }) {
  const { data: employees } = useEmployees(true);
  const { data: state, isLoading } = useEmployeeMonth(employeeId, period.year, period.month);
  return (
    <div className="space-y-4">
      <select value={employeeId ?? ''} onChange={(e) => onSelect(e.target.value)} className={`${inputCls} max-w-md`} aria-label="Empleado">
        <option value="" disabled>
          Elige una persona
        </option>
        {employees?.map((e) => (
          <option key={e.id} value={e.id}>
            {[e.lastName, e.firstName].filter(Boolean).join(', ')}
            {!e.isActive ? ' (baja)' : ''}
          </option>
        ))}
      </select>
      {employeeId && (isLoading || !state) && <p className="text-[var(--on-surface-variant)]">Cargando…</p>}
      {employeeId && state && <CheckInMonthView state={state} mode="manager" />}
    </div>
  );
}

function PendingBadge() {
  const { data } = usePendingAdjustments();
  if (!data || data.length === 0) return null;
  return <span className="rounded-full bg-[var(--error)] px-2 text-xs text-white">{data.length}</span>;
}

/** La pestaña activa vive en `?tab=` (enlazable): useSearchParams exige Suspense. */
export default function CheckInWorkdaysPage() {
  return (
    <Suspense>
      <WorkdaysContent />
    </Suspense>
  );
}

function WorkdaysContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useTabQueryParam<TabId>(TAB_IDS, 'mias');
  const [period, setPeriod] = useState<YearMonth>(currentYearMonth);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { data: own } = useOwnCheckIn(user?.id);

  if (authLoading) return null;
  const canManage = canManageCheckIn(user);
  if (user?.isSharedAccount) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">
          Las jornadas son personales: cada uno las consulta desde su propia cuenta.
        </p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof CalendarDays; badge?: boolean }[] = [
    { id: 'mias', label: 'Mis jornadas', icon: CalendarDays },
    ...(canManage
      ? [
          { id: 'equipo' as const, label: 'Equipo', icon: Users },
          { id: 'solicitudes' as const, label: 'Solicitudes', icon: Inbox, badge: true },
          { id: 'hojas' as const, label: 'Hojas de horas', icon: ClipboardCheck },
        ]
      : []),
  ];
  // Un enlace a una pestaña de gerencia abierto por quien no gestiona cae en la suya.
  const tab = tabs.some((t) => t.id === activeTab) ? activeTab : 'mias';
  // El local puede dejar al empleado solo con el mes en curso.
  const ownMonthOnly = tab === 'mias' && own?.display?.showMonthPicker === false;

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-28 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-lg text-headline-lg text-primary">Registro de jornada</h2>
        {tab !== 'solicitudes' && !ownMonthOnly && <CheckInMonthPicker value={period} onChange={setPeriod} />}
      </div>

      {tabs.length > 1 && (
        // Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav>
        <div
          role="tablist"
          aria-label="Secciones del registro de jornada"
          className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1"
        >
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'bg-[var(--primary)] text-primary-foreground'
                  : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && <PendingBadge />}
            </button>
          ))}
        </div>
      )}

      {tab === 'mias' && <OwnTab period={ownMonthOnly ? currentYearMonth() : period} />}
      {tab === 'equipo' && <TeamTab period={period} employeeId={employeeId} onSelect={setEmployeeId} />}
      {tab === 'solicitudes' && <CheckInRequestsTab />}
      {tab === 'hojas' && (
        <CheckInTimesheetsTab
          period={period}
          onOpen={(id) => {
            setEmployeeId(id);
            setActiveTab('equipo');
          }}
        />
      )}
    </div>
  );
}
