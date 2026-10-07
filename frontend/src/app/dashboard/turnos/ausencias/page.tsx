'use client';

import { Suspense, useState } from 'react';
import { CalendarRange, Inbox, PiggyBank, Settings2, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { usePendingAbsences } from '@/hooks/use-turnos';
import { useTabQueryParam } from '@/hooks/use-tab-query-param';
import { canManageCheckIn } from '../../check-in/components/check-in-form-styles';
import { CheckInMonthPicker, currentYearMonth, type YearMonth } from '../../check-in/components/check-in-month-picker';
import { AbsenceBalancesTab } from '../components/absence-balances-tab';
import { AbsenceCalendarTab } from '../components/absence-calendar-tab';
import { AbsenceRequestsTab } from '../components/absence-requests-tab';
import { AbsenceSettingsTab } from '../components/absence-settings-tab';
import { OwnAbsencesTab } from '../components/own-absences-tab';

export const dynamic = 'force-dynamic';

type TabId = 'mias' | 'calendario' | 'solicitudes' | 'saldos' | 'ajustes';
const TAB_IDS: readonly TabId[] = ['mias', 'calendario', 'solicitudes', 'saldos', 'ajustes'];

function PendingBadge({ enabled }: { enabled: boolean }) {
  const { data } = usePendingAbsences(enabled);
  if (!data || data.length === 0) return null;
  return <span className="rounded-full bg-[var(--error)] px-2 text-xs text-white">{data.length}</span>;
}

/** La pestaña activa vive en `?tab=` (enlazable): useSearchParams exige Suspense. */
export default function AbsencesPage() {
  return (
    <Suspense>
      <AbsencesContent />
    </Suspense>
  );
}

function AbsencesContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useTabQueryParam<TabId>(TAB_IDS, 'mias');
  // El calendario navega por meses; el resto de pestañas usa solo el año.
  const [period, setPeriod] = useState<YearMonth>(currentYearMonth);

  if (authLoading) return null;
  if (user?.isSharedAccount) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">
          Las ausencias son personales: cada uno las gestiona desde su propia cuenta.
        </p>
      </div>
    );
  }
  const canManage = canManageCheckIn(user);
  const tabs: { id: TabId; label: string; icon: typeof UserRound; badge?: boolean }[] = [
    { id: 'mias', label: 'Mis ausencias', icon: UserRound },
    ...(canManage
      ? [
          { id: 'calendario' as const, label: 'Calendario', icon: CalendarRange },
          { id: 'solicitudes' as const, label: 'Solicitudes', icon: Inbox, badge: true },
          { id: 'saldos' as const, label: 'Saldos', icon: PiggyBank },
          { id: 'ajustes' as const, label: 'Festivos y tipos', icon: Settings2 },
        ]
      : []),
  ];
  // Un enlace a una pestaña de gerencia abierto por quien no gestiona cae en la suya.
  const tab = tabs.some((t) => t.id === activeTab) ? activeTab : 'mias';

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-28 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-lg text-headline-lg text-primary">Ausencias y vacaciones</h2>
        {tab === 'calendario' ? (
          <CheckInMonthPicker value={period} onChange={setPeriod} allowFuture />
        ) : tab !== 'solicitudes' ? (
          <label className="flex items-center gap-2 text-sm">
            Año
            <select
              value={period.year}
              onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}
              className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base"
            >
              {[-1, 0, 1].map((delta) => {
                const year = new Date().getFullYear() + delta;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}
      </div>

      {tabs.length > 1 && (
        // Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav>
        <div
          role="tablist"
          aria-label="Secciones de ausencias"
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
              {badge && <PendingBadge enabled={canManage} />}
            </button>
          ))}
        </div>
      )}

      {tab === 'mias' && <OwnAbsencesTab year={period.year} />}
      {tab === 'calendario' && <AbsenceCalendarTab period={period} />}
      {tab === 'solicitudes' && <AbsenceRequestsTab />}
      {tab === 'saldos' && <AbsenceBalancesTab year={period.year} />}
      {tab === 'ajustes' && <AbsenceSettingsTab year={period.year} />}
    </div>
  );
}
