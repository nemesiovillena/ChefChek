'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, FileText, GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { SictedPersonasJobsTab } from '../components/sicted-personas-jobs-tab';
import { SictedPersonasTrainingTab } from '../components/sicted-personas-training-tab';
import { SictedPersonasProtocolsTab } from '../components/sicted-personas-protocols-tab';

export const dynamic = 'force-dynamic';

type TabId = 'puestos' | 'formacion' | 'protocolos';

const TABS: { id: TabId; label: string; icon: typeof Briefcase }[] = [
  { id: 'puestos', label: 'Puestos', icon: Briefcase },
  { id: 'formacion', label: 'Formación', icon: GraduationCap },
  { id: 'protocolos', label: 'Protocolos', icon: FileText },
];

/** Personas: fichas de puesto, plan de formación, protocolos con acuse versionado. */
export default function SictedPersonasPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('puestos');

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
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Personas</h2>

      {/* Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav> */}
      <div
        role="tablist"
        aria-label="Secciones de personas"
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

      {activeTab === 'puestos' && <SictedPersonasJobsTab />}
      {activeTab === 'formacion' && <SictedPersonasTrainingTab />}
      {activeTab === 'protocolos' && <SictedPersonasProtocolsTab />}
    </div>
  );
}
