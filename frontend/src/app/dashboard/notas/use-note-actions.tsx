'use client';

import { useState, type ReactNode } from 'react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { resolveErrorMessage } from '@/hooks/use-api';
import { useDeleteNote, useSetNoteDone, useUpdateNote, type Note } from '@/hooks/use-notes';
import { noteHeading } from './note-display';
import { NoteWhoDialog } from './note-who-dialog';

const MANAGER_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

interface Actor {
  id?: string;
  role?: string;
  isSharedAccount?: boolean;
}

/**
 * Acciones de una nota que comparten la página y la card del inicio. En un
 * dispositivo compartido, «Hecha» pregunta antes quién la hace (whoDialog).
 */
export function useNoteActions(actor: Actor): {
  toggleDone: (note: Note) => void;
  togglePin: (note: Note) => void;
  remove: (note: Note) => Promise<void>;
  canDelete: (note: Note) => boolean;
  busyId: string | null;
  whoDialog: ReactNode;
} {
  const setDone = useSetNoteDone();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const confirm = useConfirm();
  const addNotification = useNotification();
  const [askingWhoFor, setAskingWhoFor] = useState<Note | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isShared = actor.isSharedAccount === true;
  const isManager = !isShared && MANAGER_ROLES.includes(actor.role ?? '');

  const run = async (noteId: string, action: () => Promise<unknown>) => {
    setBusyId(noteId);
    try {
      await action();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: resolveErrorMessage(error, 'Inténtalo de nuevo.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleDone = (note: Note) => {
    if (note.doneAt) {
      run(note.id, () => setDone.mutateAsync({ id: note.id, done: false }));
    } else if (isShared) {
      setAskingWhoFor(note);
    } else {
      run(note.id, () => setDone.mutateAsync({ id: note.id, done: true }));
    }
  };

  const togglePin = (note: Note) =>
    run(note.id, () => updateNote.mutateAsync({ id: note.id, pinned: !note.pinned }));

  const remove = async (note: Note) => {
    const ok = await confirm({
      title: 'Borrar nota',
      description: `«${noteHeading(note)}» irá a la Papelera; desde allí se puede recuperar.`,
      confirmText: 'Borrar',
      variant: 'destructive',
    });
    if (ok) await run(note.id, () => deleteNote.mutateAsync(note.id));
  };

  const whoDialog = (
    <NoteWhoDialog
      open={askingWhoFor !== null}
      onCancel={() => setAskingWhoFor(null)}
      onConfirm={(byName) => {
        const note = askingWhoFor;
        setAskingWhoFor(null);
        if (note) run(note.id, () => setDone.mutateAsync({ id: note.id, done: true, byName }));
      }}
    />
  );

  return {
    toggleDone,
    togglePin,
    remove,
    canDelete: (note) => isManager || note.createdBy === actor.id,
    busyId,
    whoDialog,
  };
}
