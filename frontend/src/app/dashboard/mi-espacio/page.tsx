'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { CalendarDays, Home, Inbox, MonitorSmartphone, Plane, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useOwnProfile } from '@/hooks/use-rrhh';
import { useTabQueryParam } from '@/hooks/use-tab-query-param';
import { cardCls, secondaryBtnCls } from '../check-in/components/check-in-form-styles';
import { CheckInPersonalCard } from '../check-in/components/check-in-personal-card';
import { OwnAbsencesTab } from '../turnos/components/own-absences-tab';
import { OwnShifts } from '../turnos/components/own-shifts';
import { MyDataTab } from './components/my-data-tab';
import { MyRequestsTab } from './components/my-requests-tab';

export const dynamic = 'force-dynamic';

type TabId = 'inicio' | 'ausencias' | 'datos' | 'solicitudes';
const TAB_IDS: readonly TabId[] = ['inicio', 'ausencias', 'datos', 'solicitudes'];

function MySpace() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const [activeTab, setActiveTab] = useTabQueryParam<TabId>(TAB_IDS, 'inicio');
  const shared = user?.isSharedAccount === true;
  const { data: profile, isLoading, isError } = useOwnProfile(!shared);
  const hasTurnos = isEnabled('turnos');

  if (shared || isError) {
    return (
      <div className={cardCls}>
        <p className="font-medium">
          {shared ? 'Mi espacio se abre desde la cuenta de cada persona' : 'Tu cuenta no está vinculada a una ficha de empleado'}
        </p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {shared
            ? 'Esta es una cuenta compartida: no tiene datos personales.'
            : 'Pide a un administrador que la vincule en Equipo para ver aquí tus fichajes, turnos y datos.'}
        </p>
      </div>
    );
  }
  if (isLoading || !profile) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  const tabs = [
    { id: 'inicio' as const, label: 'Inicio', icon: Home },
    ...(hasTurnos ? [{ id: 'ausencias' as const, label: 'Ausencias', icon: Plane }] : []),
    { id: 'datos' as const, label: 'Mis datos', icon: UserRound },
    { id: 'solicitudes' as const, label: 'Solicitudes', icon: Inbox },
  ];
  // Un enlace a la pestaña de un módulo apagado cae en Inicio.
  const tab = tabs.some((t) => t.id === activeTab) ? activeTab : 'inicio';

  return (
    <>
      <p className="-mt-3 text-[var(--on-surface-variant)]">Hola, {profile.name.split(' ')[0]}.</p>
      {/* role=tablist: globals.css oculta los <nav> que no son fijos. */}
      <div role="tablist" aria-label="Secciones de Mi espacio" className="flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={(e) => {
              // En móvil la barra se desplaza: que la pestaña elegida quede a la vista.
              e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' });
              setActiveTab(id);
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 sm:px-4 text-sm font-medium transition ${
              tab === id
                ? 'bg-[var(--primary)] text-primary-foreground'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            <Icon className="h-4 w-4 max-sm:hidden" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'inicio' && (
        <div className="space-y-6">
          <CheckInPersonalCard />
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/check-in/jornadas" className={secondaryBtnCls}>
              <CalendarDays className="h-4 w-4" /> Mis fichajes y hojas de horas
            </Link>
            <Link href="/fichar" className={secondaryBtnCls}>
              <MonitorSmartphone className="h-4 w-4" /> Pantalla de fichaje
            </Link>
          </div>
          {hasTurnos && (
            <section>
              <h3 className="mb-3 text-lg font-semibold">Mis próximos turnos</h3>
              <OwnShifts />
            </section>
          )}
        </div>
      )}
      {tab === 'ausencias' && <OwnAbsencesTab year={new Date().getFullYear()} />}
      {tab === 'datos' && <MyDataTab />}
      {tab === 'solicitudes' && <MyRequestsTab />}
    </>
  );
}

/** Mi espacio: el punto único donde cada persona ficha y consulta lo suyo. */
export default function MySpacePage() {
  const { isLoading } = useAuth();
  if (isLoading) return null;
  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-6 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">Mi espacio</h2>
      {/* useTabQueryParam lee la URL: necesita Suspense. */}
      <Suspense fallback={null}>
        <MySpace />
      </Suspense>
    </div>
  );
}
