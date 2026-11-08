import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

/** Claves de color de etiqueta; deben coincidir con NOTE_TAG_COLORS del backend. */
export const NOTE_TAG_COLORS = ['sky', 'amber', 'emerald', 'rose', 'violet', 'orange', 'slate'] as const;
export type NoteTagColor = (typeof NOTE_TAG_COLORS)[number];

export interface NoteTag {
  id: string;
  name: string;
  color: NoteTagColor;
  sortOrder: number;
}

export interface Note {
  id: string;
  title: string | null;
  body: string;
  tagId: string | null;
  tag: Pick<NoteTag, 'id' | 'name' | 'color'> | null;
  isPrivate: boolean;
  pinned: boolean;
  remindAt: string | null;
  remindHasTime: boolean;
  doneAt: string | null;
  doneBy: string | null;
  doneByName: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListResponse {
  data: Note[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NoteListQuery {
  status: 'pending' | 'done';
  tagId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface NoteInput {
  body: string;
  title?: string | null;
  tagId?: string | null;
  isPrivate?: boolean;
  pinned?: boolean;
  remindAt?: string | null;
  remindHasTime?: boolean;
  /** «Quién», solo en cuenta compartida. */
  byName?: string;
}

const NOTES_KEY = ['notes'];
const NOTE_TAGS_KEY = ['note-tags'];

/** Lista, card y papelera dependen de cualquier cambio en una nota. */
function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    queryClient.invalidateQueries({ queryKey: ['trash'] });
  };
}

export function useNotes(query: NoteListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return useApiQuery<NoteListResponse>([...NOTES_KEY, 'list', qs], `/v1/notes?${qs}`, {
    placeholderData: (previous) => previous,
  });
}

/** Fijadas y que vencen hoy o antes, para la card del inicio. */
export function useNoteHighlights(sharedDevice: boolean, enabled = true) {
  return useApiQuery<Note[]>(
    [...NOTES_KEY, 'highlights', sharedDevice ? 'shared' : 'personal'],
    `/v1/notes/highlights${sharedDevice ? '?shared=1' : ''}`,
    { enabled },
  );
}

export function useNoteTags(enabled = true) {
  return useApiQuery<NoteTag[]>(NOTE_TAGS_KEY, '/v1/notes/tags', { enabled });
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async (input: NoteInput) => (await apiClient.post<Note>('/v1/notes', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<NoteInput> & { id: string }) =>
      (await apiClient.patch<Note>(`/v1/notes/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useSetNoteDone() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async ({ id, done, byName }: { id: string; done: boolean; byName?: string }) =>
      (
        await apiClient.post<Note>(
          `/v1/notes/${id}/${done ? 'done' : 'undone'}`,
          done ? { byName } : {},
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/v1/notes/${id}`)).data,
    onSuccess: invalidate,
  });
}

/** Al cambiar etiquetas también cambian las notas que las muestran. */
function useInvalidateTags() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: NOTE_TAGS_KEY });
    queryClient.invalidateQueries({ queryKey: NOTES_KEY });
  };
}

export function useCreateNoteTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async (input: { name: string; color: NoteTagColor }) =>
      (await apiClient.post<NoteTag>('/v1/notes/tags', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateNoteTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; color?: NoteTagColor }) =>
      (await apiClient.patch<NoteTag>(`/v1/notes/tags/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useReorderNoteTags() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiClient.patch<NoteTag[]>('/v1/notes/tags/reorder', { ids })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteNoteTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/v1/notes/tags/${id}`)).data,
    onSuccess: invalidate,
  });
}
