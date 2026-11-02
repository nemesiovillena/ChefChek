'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MAIL_PAGE_SIZES, type MailPageSize } from '../hooks/use-correo';

interface Props {
  pageSize: MailPageSize;
  onPageSize: (size: MailPageSize) => void;
  pageIndex: number;
  canPrev: boolean;
  canNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

const arrowBtn =
  'flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] disabled:opacity-30 disabled:hover:bg-transparent';

/** Pie de la lista: cuántos correos ver (10/20/50) y flechas a más antiguos/recientes. */
export function MailListPager({ pageSize, onPageSize, pageIndex, canPrev, canNext, loading, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--outline-variant)] px-2 py-1.5">
      <div className="flex items-center gap-1" role="group" aria-label="Correos por página">
        {MAIL_PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={size === pageSize}
            onClick={() => onPageSize(size)}
            className={`min-h-[36px] min-w-[36px] rounded-lg px-2 text-sm ${
              size === pageSize
                ? 'bg-[var(--surface-container-high)] font-semibold text-[var(--on-surface)]'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className={arrowBtn} disabled={!canPrev} onClick={onPrev} aria-label="Correos más recientes">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[2rem] text-center text-sm text-[var(--on-surface-variant)]">{pageIndex + 1}</span>
        <button
          type="button"
          className={arrowBtn}
          disabled={!canNext || loading}
          onClick={onNext}
          aria-label="Correos más antiguos"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
