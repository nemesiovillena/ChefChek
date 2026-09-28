'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { SictedPractice } from '@/lib/sicted-direccion-types';
import { NOT_APPLICABLE_LABELS, PRACTICE_EVIDENCE_LINKS } from '@/lib/sicted-practice-presentation';

const badgeCls = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold';

/** Obligatoria / De mejora + Esencial (entra en la evaluación parcial de seguimiento). */
export function SictedPracticeBadges({ practice }: { practice: SictedPractice }) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {practice.isMandatory ? (
        <span className={`${badgeCls} bg-[var(--error-container)] text-[var(--on-error-container)]`}>Obligatoria</span>
      ) : (
        <span className={`${badgeCls} bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]`}>De mejora</span>
      )}
      {practice.isEssential && (
        <span
          title="Se revisa también en las evaluaciones parciales de los años de seguimiento"
          className={`${badgeCls} bg-[var(--secondary-container)] text-[var(--on-surface)]`}
        >
          Esencial
        </span>
      )}
    </span>
  );
}

/** Descripción, documentación requerida, plantillas y enlace a la evidencia en Chefchek (desplegable). */
export function SictedPracticeDetails({ practice }: { practice: SictedPractice }) {
  const evidence = PRACTICE_EVIDENCE_LINKS[practice.code] ?? [];
  const hasDetails = practice.description || practice.requiredDocs || practice.templates || evidence.length > 0;
  if (!hasDetails) return null;

  return (
    <details className="mt-1 text-xs text-[var(--on-surface-variant)]">
      <summary className="cursor-pointer select-none py-1 font-medium text-[var(--primary)]">Ver detalle</summary>
      <div className="mt-1 space-y-2 rounded-lg bg-[var(--surface-container)] p-3">
        {practice.description && <p className="whitespace-pre-line text-[var(--on-surface)]">{practice.description}</p>}
        {practice.requiredDocs && (
          <p>
            <span className="font-semibold">Documentación requerida:</span> {practice.requiredDocs.split(';').join(' · ')}
          </p>
        )}
        {practice.templates && (
          <p>
            <span className="font-semibold">Plantillas de la web SICTED:</span> {practice.templates.split(';').join(' · ')}
          </p>
        )}
        {practice.notApplicableWhen.length > 0 && (
          <p>
            <span className="font-semibold">No aplica</span>{' '}
            {practice.notApplicableWhen.map((k) => NOT_APPLICABLE_LABELS[k] ?? k).join(', ')}.
          </p>
        )}
        {practice.relatedCodes.length > 0 && (
          <p>
            <span className="font-semibold">Relacionadas:</span> {practice.relatedCodes.join(', ')}
          </p>
        )}
        {evidence.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">Ir a Chefchek:</span>
            {evidence.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex items-center gap-1 font-medium text-[var(--primary)] underline">
                <ExternalLink className="h-3 w-3" /> {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
