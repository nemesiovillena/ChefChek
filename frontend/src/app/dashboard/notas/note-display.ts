import type { Note, NoteTagColor } from '@/hooks/use-notes';

/** Clases de cada color de etiqueta (literal para que Tailwind las genere), con modo oscuro. */
export const NOTE_COLOR_CLASSES: Record<
  NoteTagColor,
  { card: string; chip: string; swatch: string; label: string }
> = {
  sky: {
    card: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800',
    chip: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100',
    swatch: 'bg-sky-400',
    label: 'Azul',
  },
  amber: {
    card: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    swatch: 'bg-amber-400',
    label: 'Amarillo',
  },
  emerald: {
    card: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
    chip: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
    swatch: 'bg-emerald-400',
    label: 'Verde',
  },
  rose: {
    card: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
    chip: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
    swatch: 'bg-rose-400',
    label: 'Rosa',
  },
  violet: {
    card: 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800',
    chip: 'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
    swatch: 'bg-violet-400',
    label: 'Morado',
  },
  orange: {
    card: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800',
    chip: 'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100',
    swatch: 'bg-orange-400',
    label: 'Naranja',
  },
  slate: {
    card: 'bg-slate-50 border-slate-200 dark:bg-slate-900/60 dark:border-slate-700',
    chip: 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100',
    swatch: 'bg-slate-400',
    label: 'Gris',
  },
};

/** Nota sin etiqueta: tarjeta neutra con los tokens del tema. */
export const NOTE_NO_TAG_CARD = 'bg-surface-container-low border-border';

export type NoteDue = 'overdue' | 'today' | 'later' | null;

/** Estado del aviso por días naturales del dispositivo (no por hora exacta). */
export function noteDue(note: Pick<Note, 'remindAt' | 'doneAt'>, now = new Date()): NoteDue {
  if (!note.remindAt || note.doneAt) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const remindAt = new Date(note.remindAt).getTime();
  if (remindAt < startOfToday.getTime()) return 'overdue';
  if (remindAt < startOfTomorrow.getTime()) return 'today';
  return 'later';
}

export function formatRemindTime(note: Pick<Note, 'remindAt'>): string {
  if (!note.remindAt) return '';
  return new Date(note.remindAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function formatRemind(note: Pick<Note, 'remindAt' | 'remindHasTime'>): string {
  if (!note.remindAt) return '';
  const day = new Date(note.remindAt).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return note.remindHasTime ? `${day}, ${formatRemindTime(note)}` : day;
}

/** Título visible: el propio o la primera línea del texto. */
export function noteHeading(note: Pick<Note, 'title' | 'body'>): string {
  return note.title?.trim() || note.body.split('\n')[0].trim();
}

/** «Quién» recordado en este dispositivo (cuentas compartidas). Solo comodidad. */
const WHO_STORAGE_KEY = 'chefchek.notes.lastWho';

export function readLastWho(): string {
  try {
    return window.localStorage.getItem(WHO_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberWho(name: string): void {
  try {
    window.localStorage.setItem(WHO_STORAGE_KEY, name);
  } catch {
    // Sin almacenamiento (modo privado): se volverá a pedir.
  }
}
