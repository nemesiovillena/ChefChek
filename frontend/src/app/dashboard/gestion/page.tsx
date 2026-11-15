'use client';

import { GestionDashboardView } from '@/features/gestion/components/gestion-dashboard-view';
import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';

export default function GestionPage() {
  return (
    <GestionPageShell>
      <GestionDashboardView />
    </GestionPageShell>
  );
}
