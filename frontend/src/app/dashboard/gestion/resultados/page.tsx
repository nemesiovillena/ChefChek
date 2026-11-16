'use client';

import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GestionResultsView } from '@/features/gestion/components/gestion-results-view';

export default function GestionResultadosPage() {
  return (
    <GestionPageShell>
      <GestionResultsView />
    </GestionPageShell>
  );
}
