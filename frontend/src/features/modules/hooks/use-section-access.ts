'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { fetchMySectionAccess, type SectionAccessMap } from '../api/role-access-api';

/**
 * Per-role section visibility, shared across every consumer via a module-level
 * store (mirrors what a context would give us without the provider plumbing).
 * The fetch fires once while any component is mounted; `refetch` forces a
 * reload after the OWNER changes the config.
 */
let cache: SectionAccessMap | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load(): Promise<void> {
  if (!inflight) {
    inflight = fetchMySectionAccess()
      .then((map) => {
        cache = map;
      })
      .catch(() => {
        // On failure keep everything visible rather than locking the user out.
        cache = {};
      })
      .finally(emit);
  }
  return inflight;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  void load();
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Force a reload (e.g. after the OWNER saves new role-access config, or a 403
 * SECTION_HIDDEN). Keeps the stale map visible until the new one resolves to
 * avoid a flash of the full (unrestricted) navigation.
 */
export async function refetchSectionAccess(): Promise<void> {
  inflight = null;
  await load();
}

/** Clear the shared map — call on logout so the next user starts fresh. */
export function resetSectionAccess(): void {
  inflight = null;
  cache = null;
  emit();
}

interface UseSectionAccessResult {
  /** Null while not yet loaded. */
  map: SectionAccessMap | null;
  refetch: () => Promise<void>;
  /**
   * Whether the current user may see a section. True for an undefined key, while
   * loading, and for any key absent from the map (ADMIN+ get an empty map).
   */
  canSee: (sectionKey?: string) => boolean;
}

export function useSectionAccess(): UseSectionAccessResult {
  const map = useSyncExternalStore(
    subscribe,
    () => cache,
    () => cache,
  );

  const canSee = useCallback(
    (sectionKey?: string) => {
      if (!sectionKey) return true;
      if (!map) return true;
      return map[sectionKey] ?? true;
    },
    [map],
  );

  return { map, refetch: refetchSectionAccess, canSee };
}
