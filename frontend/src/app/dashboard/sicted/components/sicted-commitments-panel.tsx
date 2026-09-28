'use client';

import Link from 'next/link';
import { CalendarClock, CheckCircle2, Circle, CircleDashed, ExternalLink, Globe, Loader2, MinusCircle } from 'lucide-react';
import { useSictedCommitments } from '@/hooks/use-sicted-direccion';
import {
  CYCLE_PHASE_LABELS,
  type CommitmentKey,
  type CommitmentStatus,
  type SictedCommitmentItem,
} from '@/lib/sicted-direccion-types';

/** Dónde se registra en Chefchek cada compromiso (el manual de marca solo existe en la web oficial). */
const COMMITMENT_LINKS: Record<CommitmentKey, { href: string; external?: boolean }> = {
  LEGALIDAD: { href: '/dashboard/sicted/direccion?tab=legal' },
  MANUAL_MARCA: { href: 'https://www.sicted.es', external: true },
  FORMACION: { href: '/dashboard/sicted/personas?tab=formacion' },
  ATI: { href: '/dashboard/sicted/direccion?tab=eventos' },
  ATC: { href: '/dashboard/sicted/direccion?tab=eventos' },
  AUTOEVALUACION: { href: '/dashboard/sicted/direccion?tab=autoevaluacion' },
  PLAN_MEJORA: { href: '/dashboard/sicted/direccion?tab=mejora' },
  GRUPO_MEJORA: { href: '/dashboard/sicted/direccion?tab=eventos' },
  EVALUACION_EXTERNA: { href: '/dashboard/sicted/direccion?tab=eventos' },
};

const STATUS_STYLE: Record<CommitmentStatus, { label: string; cls: string; Icon: typeof Circle }> = {
  DONE: { label: 'Cumple', cls: 'text-green-600 dark:text-green-400', Icon: CheckCircle2 },
  IN_PROGRESS: { label: 'En curso', cls: 'text-amber-600 dark:text-amber-400', Icon: CircleDashed },
  PENDING: { label: 'Pendiente', cls: 'text-[var(--error)]', Icon: Circle },
  MANUAL: { label: 'En la web SICTED', cls: 'text-[var(--on-surface-variant)]', Icon: Globe },
  NOT_APPLICABLE: { label: 'No aplica', cls: 'text-[var(--on-surface-variant)]', Icon: MinusCircle },
};

function CommitmentRow({ item }: { item: SictedCommitmentItem }) {
  const { label, cls, Icon } = STATUS_STYLE[item.status];
  const link = COMMITMENT_LINKS[item.key];
  const content = (
    <>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />
      <span className="flex-1">
        <span className="block text-sm font-medium">
          {item.label}
          {item.requirement === 'RECOMMENDED' && (
            <span className="font-normal text-[var(--on-surface-variant)]"> · recomendable</span>
          )}
        </span>
        <span className="block text-xs text-[var(--on-surface-variant)]">{item.detail}</span>
      </span>
      <span className={`shrink-0 text-xs font-semibold ${cls}`}>{label}</span>
      {link.external && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" />}
    </>
  );
  const rowCls =
    'flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-[var(--surface-container)]';
  return link.external ? (
    <a href={link.href} target="_blank" rel="noreferrer" className={rowCls}>
      {content}
    </a>
  ) : (
    <Link href={link.href} className={rowCls}>
      {content}
    </Link>
  );
}

/**
 * Compromisos de la fase actual del ciclo de distinción, calculados con lo
 * registrado en Chefchek (espejo del «visor de cumplimiento» de la web
 * SICTED). Los que no aplican a la fase se ocultan.
 */
export function SictedCommitmentsPanel() {
  const { data, isLoading } = useSictedCommitments();

  if (isLoading) {
    return (
      <div className="mb-6 flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }
  if (!data) return null;

  if (!data.phase) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-[var(--outline-variant)] p-4 text-sm text-[var(--on-surface-variant)]">
        Indica en qué fase del distintivo estás y la fecha del próximo comité para ver aquí tus compromisos pendientes.{' '}
        <Link href="/dashboard/settings#sicted" className="font-medium text-[var(--primary)] underline">
          Configurar fase
        </Link>
      </div>
    );
  }

  const items = data.items.filter((i) => i.status !== 'NOT_APPLICABLE');
  const done = items.filter((i) => i.status === 'DONE').length;
  const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS').length;

  return (
    <section className="mb-6 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
            Compromisos · fase {CYCLE_PHASE_LABELS[data.phase]}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {done} cumplidos · {pending} por completar
          </p>
        </div>
        <Link
          href="/dashboard/settings#sicted"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-medium"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {data.nextCommitteeDate
            ? `Comité: ${new Date(data.nextCommitteeDate).toLocaleDateString('es-ES')}${
                data.daysToCommittee !== null && data.daysToCommittee >= 0 ? ` (en ${data.daysToCommittee} días)` : ''
              }`
            : 'Fijar fecha del comité'}
        </Link>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <CommitmentRow key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}
