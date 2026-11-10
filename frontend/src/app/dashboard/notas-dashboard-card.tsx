'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { useNoteHighlights } from '@/hooks/use-notes';
import { NOTE_COLOR_CLASSES, noteDue, noteHeading } from './notas/note-display';
import { useNoteActions } from './notas/use-note-actions';

/**
 * Card Notas del inicio: todas las pendientes, fijadas primero. En un
 * dispositivo compartido (o su vista previa) nunca salen notas privadas.
 * Se marcan hechas desde aquí; el resto de la card abre la página.
 */
export function NotasDashboardCard({ sharedDevice }: { sharedDevice: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useNoteHighlights(sharedDevice);
  const actions = useNoteActions({
    id: user?.id,
    role: user?.role,
    isSharedAccount: user?.isSharedAccount === true,
  });
  const overdue = notes.filter((n) => noteDue(n) === 'overdue').length;

  return (
    <div
      onClick={() => router.push('/dashboard/notas')}
      className="tonal-layer-2 rounded-xl p-stack-lg md:p-stack-md flex flex-col gap-stack-md border border-border cursor-pointer hover:border-secondary transition-colors h-full min-h-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-stack-sm">
        <div className="flex items-center gap-stack-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary">
            <span className="material-symbols-outlined text-[22px]">sticky_note_2</span>
          </span>
          <div>
            <h5 className="font-label-md text-label-md text-primary uppercase tracking-wide">Notas</h5>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Pendientes</p>
          </div>
        </div>
        {overdue > 0 && (
          <span className="rounded-full bg-error-container px-3 py-1 font-label-sm text-label-sm text-on-error-container">
            {overdue} {overdue === 1 ? 'vencida' : 'vencidas'}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="font-label-md text-label-md text-on-surface-variant">No hay notas pendientes</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {notes.map((note) => {
            const due = noteDue(note);
            return (
              <li key={note.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Marcar como hecha: ${noteHeading(note)}`}
                  title="Hecha"
                  disabled={actions.busyId === note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.toggleDone(note);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-on-surface-variant hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    note.tag ? NOTE_COLOR_CLASSES[note.tag.color].swatch : 'bg-outline-variant'
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-primary">
                  {noteHeading(note)}
                </span>
                {note.pinned && (
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-label="Fijada">
                    push_pin
                  </span>
                )}
                {due === 'overdue' && (
                  <span className="shrink-0 font-label-sm text-label-sm text-error">Vencida</span>
                )}
                {due === 'today' && (
                  <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">Hoy</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* El diálogo «¿Quién?» se pinta fuera del flujo; sus clics no deben abrir la página. */}
      <div onClick={(e) => e.stopPropagation()}>{actions.whoDialog}</div>
    </div>
  );
}
