'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SictedRunChecklist } from '../../components/sicted-run-checklist';

export const dynamic = 'force-dynamic';

/** Detalle solo lectura de una hoja: histórico de marcas y correcciones, sin controles de edición. */
export default function SictedRunDetailPage() {
  const router = useRouter();
  const params = useParams<{ runId: string }>();

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
      <SictedRunChecklist runId={params.runId} readOnly />
    </div>
  );
}
