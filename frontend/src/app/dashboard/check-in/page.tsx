'use client';

import Link from 'next/link';
import { MonitorSmartphone, Settings2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { CheckInPersonalCard } from './components/check-in-personal-card';
import { CheckInPresencePanel } from './components/check-in-presence-panel';
import { CheckInReadinessBanner } from './components/check-in-readiness-banner';
import { CheckInReviewPanel } from './components/check-in-review-panel';
import { canManageCheckIn, secondaryBtnCls } from './components/check-in-form-styles';

export const dynamic = 'force-dynamic';

/** Fichar desde la cuenta personal y, para gerencia, quién está trabajando ahora. */
export default function CheckInPage() {
  const { user, isLoading: authLoading } = useAuth();
  if (authLoading) return null;
  const canManage = canManageCheckIn(user);
  const isShared = user?.isSharedAccount === true;

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-6 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">Fichar</h2>

      {canManage && <CheckInReadinessBanner />}

      <CheckInPersonalCard />

      <p className="text-sm text-[var(--on-surface-variant)]">
        Para fichar también sin conexión, usa la{' '}
        <Link href="/fichar" className="underline">
          pantalla de fichaje
        </Link>{' '}
        e instálala en tu móvil.
      </p>

      {(canManage || isShared) && (
        <div className="flex flex-wrap gap-2">
          <Link href="/fichar" className={secondaryBtnCls}>
            <MonitorSmartphone className="h-4 w-4" /> {isShared ? 'Abrir modo kiosco' : 'Pantalla de fichaje'}
          </Link>
          {canManage && (
            <>
              <Link href="/dashboard/check-in/empleados" className={secondaryBtnCls}>
                <Users className="h-4 w-4" /> Empleados
              </Link>
              <Link href="/dashboard/check-in/configuracion" className={secondaryBtnCls}>
                <Settings2 className="h-4 w-4" /> Ajustes de fichaje
              </Link>
            </>
          )}
        </div>
      )}

      {canManage && <CheckInReviewPanel />}

      {canManage && (
        <section>
          <h3 className="mb-3 text-lg font-semibold">Ahora mismo</h3>
          <CheckInPresencePanel />
        </section>
      )}
    </div>
  );
}
