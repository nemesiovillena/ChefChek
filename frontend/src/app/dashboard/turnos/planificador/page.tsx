'use client';

import { useAuth } from '@/contexts/auth.context';
import { canManageCheckIn } from '../../check-in/components/check-in-form-styles';
import { OwnShifts } from '../components/own-shifts';
import { SchedulePlanner } from '../components/schedule-planner';

export const dynamic = 'force-dynamic';

/**
 * Turnos. Gerencia planifica la semana en la rejilla; el resto consulta sus
 * turnos publicados.
 */
export default function SchedulePage() {
  const { user, isLoading: authLoading } = useAuth();
  if (authLoading) return null;
  if (user?.isSharedAccount) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width pb-24 pt-8">
        <p className="text-[var(--on-surface-variant)]">Los turnos se consultan desde la cuenta de cada persona.</p>
      </div>
    );
  }
  const canManage = canManageCheckIn(user);
  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-6 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">{canManage ? 'Planificador de turnos' : 'Mis turnos'}</h2>
      {canManage ? (
        <>
          <SchedulePlanner />
          <section>
            <h3 className="mb-3 text-lg font-semibold">Mis turnos</h3>
            <OwnShifts />
          </section>
        </>
      ) : (
        <OwnShifts />
      )}
    </div>
  );
}
