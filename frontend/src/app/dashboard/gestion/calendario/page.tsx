'use client';

import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GestionSeasonalityView } from '@/features/gestion/components/gestion-seasonality-view';

export default function GestionCalendarioPage() {
  return (
    <GestionPageShell>
      <GestionSeasonalityView />
    </GestionPageShell>
  );
}
