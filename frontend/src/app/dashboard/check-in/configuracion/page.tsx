'use client';

import { Suspense } from 'react';
import { Clock, FileText, MapPin, Scale } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useTabQueryParam } from '@/hooks/use-tab-query-param';
import { CheckInAgreementTab } from '../components/check-in-agreement-tab';
import { CheckInWorkdayTab } from '../components/check-in-workday-tab';
import { CheckInWorkCentersTab } from '../components/check-in-work-centers-tab';
import { CheckInLegalTextsTab } from '../components/check-in-legal-texts-tab';
import { CheckInReadinessBanner } from '../components/check-in-readiness-banner';

export const dynamic = 'force-dynamic';

type TabId = 'convenio' | 'jornada' | 'centros' | 'textos';
const TAB_IDS: readonly TabId[] = ['convenio', 'jornada', 'centros', 'textos'];

const TABS: { id: TabId; label: string; icon: typeof Scale }[] = [
  { id: 'convenio', label: 'Convenio', icon: Scale },
  { id: 'jornada', label: 'Jornada y pausas', icon: Clock },
  { id: 'centros', label: 'Centros', icon: MapPin },
  { id: 'textos', label: 'Textos legales', icon: FileText },
];

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** La pestaña activa vive en `?tab=` (enlazable): useSearchParams exige Suspense. */
export default function CheckInConfigurationPage() {
  return (
    <Suspense>
      <CheckInConfigurationContent />
    </Suspense>
  );
}

function CheckInConfigurationContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useTabQueryParam<TabId>(TAB_IDS, 'convenio');

  if (authLoading) return null;
  if (!MANAGE_ROLES.includes(user?.role ?? '')) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Ajustes de fichaje</h2>

      <CheckInReadinessBanner withLink={activeTab !== 'textos'} />

      {/* Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav> */}
      <div
        role="tablist"
        aria-label="Secciones de ajustes de fichaje"
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

      {activeTab === 'convenio' && <CheckInAgreementTab />}
      {activeTab === 'jornada' && <CheckInWorkdayTab />}
      {activeTab === 'centros' && <CheckInWorkCentersTab />}
      {activeTab === 'textos' && <CheckInLegalTextsTab />}
    </div>
  );
}
