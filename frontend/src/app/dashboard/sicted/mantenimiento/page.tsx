'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, ClipboardList, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { SictedMaintenanceCalendarTab } from '../components/sicted-maintenance-calendar-tab';
import { SictedMaintenanceAssetsTab } from '../components/sicted-maintenance-assets-tab';
import { SictedMaintenanceIncidentsTab } from '../components/sicted-maintenance-incidents-tab';

export const dynamic = 'force-dynamic';

type TabId = 'calendario' | 'equipos' | 'averias';

const TABS: { id: TabId; label: string; icon: typeof CalendarClock }[] = [
  { id: 'calendario', label: 'Calendario', icon: CalendarClock },
  { id: 'equipos', label: 'Equipos', icon: Wrench },
  { id: 'averias', label: 'Averías', icon: ClipboardList },
];

/** Mantenimiento: calendario de revisiones, inventario de equipos, partes de avería/PAC. */
export default function SictedMantenimientoPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('calendario');

  if (authLoading) return null;

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard/sicted')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a SICTED
      </button>
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Mantenimiento</h2>

      {/* Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav> */}
      <div
        role="tablist"
        aria-label="Secciones de mantenimiento"
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === id
                ? 'bg-[var(--primary)] text-primary-foreground'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'calendario' && <SictedMaintenanceCalendarTab />}
      {activeTab === 'equipos' && <SictedMaintenanceAssetsTab />}
      {activeTab === 'averias' && <SictedMaintenanceIncidentsTab />}
    </div>
  );
}
