'use client';

import { useSyncExternalStore } from 'react';

// Component to ensure client-side only rendering.
// useSyncExternalStore with a client-only snapshot avoids setState-in-effect:
// the server snapshot returns false, the client snapshot returns true, and React
// handles the transition without an explicit effect.
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const hasMounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
