'use client';

import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { GestionTicketsView } from '@/features/gestion/components/gestion-tickets-view';

export default function GestionTicketsPage() {
  return (
    <GestionPageShell>
      <GestionTicketsView />
    </GestionPageShell>
  );
}
