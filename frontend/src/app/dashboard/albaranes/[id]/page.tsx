'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AlbaranDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/dashboard/albaranes/${id}/resumen`);
  }, [router, id]);

  return null;
}
