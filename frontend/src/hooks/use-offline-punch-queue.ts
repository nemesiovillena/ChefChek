'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  isOnline,
  pendingPunches,
  subscribeOffline,
  syncPendingPunches,
  type SyncOutcome,
} from '@/lib/check-in-offline';
import { CHECK_IN_KEYS } from './use-check-in';

/**
 * Estado de la red y de los fichajes pendientes de enviar de esta cuenta.
 * Mientras alguna pantalla lo use, intenta enviar la cola sola: al abrirse,
 * al volver la red y al volver a primer plano (iOS no avisa de "online" con
 * la app en segundo plano).
 */
export function useOfflinePunchQueue(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { subscribe, syncNow } = useMemo(() => {
    const syncNow = async (): Promise<SyncOutcome[]> => {
      const outcomes = await syncPendingPunches(userId);
      if (outcomes.length > 0) {
        queryClient.invalidateQueries({ queryKey: CHECK_IN_KEYS.me });
        queryClient.invalidateQueries({ queryKey: CHECK_IN_KEYS.kiosk });
      }
      return outcomes;
    };
    const trySync = () => {
      if (navigator.onLine) void syncNow().catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') trySync();
    };
    const subscribe = (callback: () => void) => {
      const unsubscribe = subscribeOffline(callback);
      window.addEventListener('online', trySync);
      document.addEventListener('visibilitychange', onVisible);
      trySync();
      return () => {
        unsubscribe();
        window.removeEventListener('online', trySync);
        document.removeEventListener('visibilitychange', onVisible);
      };
    };
    return { subscribe, syncNow };
  }, [userId, queryClient]);

  // Un valor primitivo: useSyncExternalStore compara por identidad.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => `${isOnline() ? 1 : 0}|${pendingPunches(userId).length}`,
    () => '1|0',
  );
  const [online, count] = snapshot.split('|');

  return { online: online === '1', pendingCount: Number(count), syncNow };
}
