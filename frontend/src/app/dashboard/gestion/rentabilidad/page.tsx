'use client';

import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GestionProfitabilityView } from '@/features/gestion/components/gestion-profitability-view';

export default function GestionRentabilidadPage() {
  return (
    <GestionPageShell>
      <GestionProfitabilityView />
    </GestionPageShell>
  );
}
