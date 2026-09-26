'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, ClipboardCheck, ClipboardList, FileText, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { SictedDireccionCatalogTab } from '../components/sicted-direccion-catalog-tab';
import { SictedDireccionAssessmentTab } from '../components/sicted-direccion-assessment-tab';
import { SictedDireccionImprovementTab } from '../components/sicted-direccion-improvement-tab';
import { SictedDireccionObjectivesTab } from '../components/sicted-direccion-objectives-tab';
import { SictedDireccionEventsTab } from '../components/sicted-direccion-events-tab';
import { SictedDireccionLegalTab } from '../components/sicted-direccion-legal-tab';

export const dynamic = 'force-dynamic';

type TabId = 'catalogo' | 'autoevaluacion' | 'mejora' | 'objetivos' | 'eventos' | 'legal';

const TABS: { id: TabId; label: string; icon: typeof ClipboardCheck }[] = [
  { id: 'catalogo', label: 'Catálogo', icon: ClipboardCheck },
  { id: 'autoevaluacion', label: 'Autoevaluación', icon: ClipboardList },
  { id: 'mejora', label: 'Plan de mejora', icon: Target },
  { id: 'objetivos', label: 'Objetivos', icon: TrendingUp },
  { id: 'eventos', label: 'Eventos', icon: Calendar },
  { id: 'legal', label: 'Legal', icon: FileText },
];

/**
 * Dirección: catálogo de buenas prácticas (BP1-BP6) y autoevaluación con la
 * escala real 1-5 + No aplica. Herramienta de apoyo interno — no sustituye
 * la evaluación oficial de un evaluador externo SICTED.
 */
export default function SictedDireccionPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('catalogo');

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
      <h2 className="font-headline-lg text-headline-lg text-primary mb-1">Dirección</h2>
      <p className="mb-6 text-sm text-[var(--on-surface-variant)]">
        Herramienta de apoyo a la autoevaluación interna — no sustituye la evaluación oficial de un evaluador externo SICTED.
      </p>

      {/* Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav> */}
      <div
        role="tablist"
        aria-label="Secciones de dirección"
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

      {activeTab === 'catalogo' && <SictedDireccionCatalogTab />}
      {activeTab === 'autoevaluacion' && <SictedDireccionAssessmentTab />}
      {activeTab === 'mejora' && <SictedDireccionImprovementTab />}
      {activeTab === 'objetivos' && <SictedDireccionObjectivesTab />}
      {activeTab === 'eventos' && <SictedDireccionEventsTab />}
      {activeTab === 'legal' && <SictedDireccionLegalTab />}
    </div>
  );
}
