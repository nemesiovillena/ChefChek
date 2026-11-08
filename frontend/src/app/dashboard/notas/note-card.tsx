'use client';

import type { Note } from '@/hooks/use-notes';
import {
  formatRemind,
  formatRemindTime,
  NOTE_COLOR_CLASSES,
  NOTE_NO_TAG_CARD,
  noteDue,
  noteHeading,
} from './note-display';

interface NoteCardProps {
  note: Note;
  /** Puede borrar: autor o gerencia. */
  canDelete: boolean;
  busy?: boolean;
  onOpen: () => void;
  onToggleDone: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50';

/** Post-it: color de su etiqueta; acciones siempre visibles (pantallas táctiles). */
export function NoteCard({
  note,
  canDelete,
  busy,
  onOpen,
  onToggleDone,
  onTogglePin,
  onDelete,
}: NoteCardProps) {
  const colors = note.tag ? NOTE_COLOR_CLASSES[note.tag.color] : null;
  const due = noteDue(note);
  const done = Boolean(note.doneAt);
  const heading = noteHeading(note);
  // Si no hay título, la primera línea ya hace de título: no repetirla.
  const rest = note.title?.trim() ? note.body : note.body.split('\n').slice(1).join('\n').trim();

  return (
    <article
      className={`flex flex-col rounded-lg border p-stack-md shadow-sm ${colors?.card ?? NOTE_NO_TAG_CARD} ${
        done ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Abrir nota: ${heading}`}
        >
          <h3
            className={`font-body-lg text-body-lg font-semibold text-on-surface break-words ${
              done ? 'line-through' : ''
            }`}
          >
            {heading}
          </h3>
          {rest && (
            <p className="mt-1 whitespace-pre-line break-words text-body-md text-on-surface line-clamp-6">
              {rest}
            </p>
          )}
        </button>
        {note.isPrivate && (
          <span
            className="material-symbols-outlined text-[18px] text-on-surface-variant"
            title="Solo para mí"
            aria-label="Solo para mí"
          >
            lock
          </span>
        )}
      </div>

      <div className="mt-stack-sm flex flex-wrap items-center gap-1.5">
        {note.tag && (
          <span className={`rounded-full px-2 py-0.5 text-label-sm font-medium ${colors?.chip}`}>
            {note.tag.name}
          </span>
        )}
        {due === 'overdue' && (
          <span className="rounded-full bg-error px-2 py-0.5 text-label-sm font-medium text-on-error">
            Vencida · {formatRemind(note)}
          </span>
        )}
        {due === 'today' && (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-label-sm font-medium text-amber-950 dark:bg-amber-400 dark:text-amber-950">
            Vence hoy{note.remindHasTime ? ` · ${formatRemindTime(note)}` : ''}
          </span>
        )}
        {due === 'later' && (
          <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px]">event</span>
            {formatRemind(note)}
          </span>
        )}
      </div>

      <p className="mt-stack-sm text-label-sm text-on-surface-variant">
        {done
          ? `Hecha por ${note.doneByName || '—'} · ${new Date(note.doneAt!).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            })}`
          : `${note.createdByName || '—'} · ${new Date(note.createdAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            })}`}
      </p>

      <div className="mt-auto flex items-center justify-end gap-1 pt-stack-sm">
        <button
          type="button"
          className={iconButton}
          onClick={onTogglePin}
          disabled={busy || done}
          title={note.pinned ? 'Desfijar' : 'Fijar arriba'}
          aria-label={note.pinned ? 'Desfijar' : 'Fijar arriba'}
          aria-pressed={note.pinned}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={note.pinned ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            push_pin
          </span>
        </button>
        {canDelete && (
          <button
            type="button"
            className={iconButton}
            onClick={onDelete}
            disabled={busy}
            title="Borrar"
            aria-label="Borrar"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleDone}
          disabled={busy}
          className={`inline-flex h-10 items-center gap-1 rounded-full px-3 text-label-md font-medium disabled:opacity-50 ${
            done
              ? 'text-on-surface-variant hover:bg-black/5 dark:hover:bg-white/10'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{done ? 'undo' : 'check'}</span>
          {done ? 'Deshacer' : 'Hecha'}
        </button>
      </div>
    </article>
  );
}
