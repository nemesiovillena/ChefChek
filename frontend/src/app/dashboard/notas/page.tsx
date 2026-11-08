'use client';

import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth.context';
import { useNotes, useNoteTags, type Note } from '@/hooks/use-notes';
import { NoteCard } from './note-card';
import { NoteFormModal } from './note-form-modal';
import { NoteTagsManagerModal } from './note-tags-manager-modal';
import { NOTE_COLOR_CLASSES } from './note-display';
import { useNoteActions } from './use-note-actions';

const PAGE_SIZE = 30;
const MANAGER_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

type Status = 'pending' | 'done';

export default function NotasPage() {
  const { user } = useAuth();
  const isSharedAccount = user?.isSharedAccount === true;
  const isManager = !isSharedAccount && MANAGER_ROLES.includes(user?.role ?? '');

  const [status, setStatus] = useState<Status>('pending');
  const [tagId, setTagId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState<Note | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const { data: tags = [] } = useNoteTags();
  const { data, isLoading, isFetching } = useNotes({
    status,
    tagId: tagId ?? undefined,
    q: search || undefined,
    page: 1,
    // «Ver más» amplía la página en vez de paginar: la lista sigue ordenada entera.
    pageSize: Math.min(PAGE_SIZE * pageCount, 100),
  });
  const notes = data?.data ?? [];
  const total = data?.total ?? 0;
  const actions = useNoteActions({
    id: user?.id,
    role: user?.role,
    isSharedAccount,
  });

  const resetPaging = () => setPageCount(1);
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim());
      resetPaging();
    }, 300);
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-28 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-stack-lg">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">
            Herramientas
          </span>
          <div className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Notas</div>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Button variant="outline" onClick={() => setTagsOpen(true)}>
              <span className="material-symbols-outlined mr-1 text-[18px]">sell</span>
              Etiquetas
            </Button>
          )}
          <Button size="lg" onClick={openNew}>
            <Plus className="mr-1 h-5 w-5" />
            Nota
          </Button>
        </div>
      </div>

      <div className="mb-stack-md flex flex-col gap-3 md:flex-row md:items-center">
        <div role="tablist" aria-label="Estado" className="inline-flex rounded-full border border-border p-1">
          {(
            [
              ['pending', 'Pendientes'],
              ['done', 'Hechas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => {
                setStatus(value);
                resetPaging();
              }}
              className={`min-h-10 rounded-full px-4 text-label-md font-medium ${
                status === value ? 'bg-primary text-primary-foreground' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Buscar en notas"
          placeholder="Buscar en notas…"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="text-base md:max-w-xs"
        />
      </div>

      {tags.length > 0 && (
        <div className="mb-stack-lg flex flex-wrap gap-2" aria-label="Filtrar por etiqueta">
          <button
            type="button"
            aria-pressed={tagId === null}
            onClick={() => {
              setTagId(null);
              resetPaging();
            }}
            className={`min-h-10 rounded-full border px-3 text-label-md ${
              tagId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-on-surface-variant'
            }`}
          >
            Todas
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              aria-pressed={tagId === tag.id}
              onClick={() => {
                setTagId(tagId === tag.id ? null : tag.id);
                resetPaging();
              }}
              className={`min-h-10 rounded-full border-2 px-3 text-label-md ${NOTE_COLOR_CLASSES[tag.color].chip} ${
                tagId === tag.id ? 'border-primary' : 'border-transparent'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px]">sticky_note_2</span>
          <p className="mt-2 text-body-md">
            {search || tagId
              ? 'No hay notas con este filtro.'
              : status === 'done'
                ? 'Todavía no hay notas hechas.'
                : 'Nada pendiente. Apunta lo que no quieras olvidar.'}
          </p>
          {status === 'pending' && !search && (
            <Button className="mt-4" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Nueva nota
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                canDelete={actions.canDelete(note)}
                busy={actions.busyId === note.id}
                onOpen={() => {
                  setEditing(note);
                  setFormOpen(true);
                }}
                onToggleDone={() => actions.toggleDone(note)}
                onTogglePin={() => actions.togglePin(note)}
                onDelete={() => actions.remove(note)}
              />
            ))}
          </div>
          {notes.length < total && (
            <div className="mt-stack-lg flex justify-center">
              <Button
                variant="outline"
                disabled={isFetching || PAGE_SIZE * pageCount >= 100}
                onClick={() => setPageCount((n) => n + 1)}
              >
                {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ver más ({total - notes.length})
              </Button>
            </div>
          )}
        </>
      )}

      <NoteFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        note={editing}
        tags={tags}
        defaultTagId={tagId}
        isSharedAccount={isSharedAccount}
        currentUserId={user?.id}
      />
      {isManager && <NoteTagsManagerModal open={tagsOpen} onOpenChange={setTagsOpen} tags={tags} />}
      {actions.whoDialog}
    </div>
  );
}
