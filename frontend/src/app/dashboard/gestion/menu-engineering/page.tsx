'use client';

import { Suspense } from 'react';
import { GestionPageShell } from '@/features/gestion/components/gestion-page-shell';
import { MenuEngineeringView } from '@/features/gestion/components/menu-engineering-view';

export default function GestionMenuEngineeringPage() {
  return (
    <GestionPageShell>
      {/* useSearchParams (pestaña en la URL) necesita Suspense en el build estático. */}
      <Suspense fallback={null}>
        <MenuEngineeringView />
      </Suspense>
    </GestionPageShell>
  );
}
