'use client';

import { useState, type MouseEvent } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useNotification } from '@/components/notification-system';
import { resolveErrorMessage } from '@/hooks/use-api';
import {
  useCreateNote,
  useUpdateNote,
  type Note,
  type NoteInput,
  type NoteTag,
} from '@/hooks/use-notes';
import { NOTE_COLOR_CLASSES, readLastWho, rememberWho } from './note-display';

interface FormState {
  body: string;
  title: string;
  tagId: string | null;
  pinned: boolean;
  isPrivate: boolean;
  remindDate: string;
  remindTime: string;
  byName: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toFormState(note: Note | null, defaultTagId: string | null): FormState {
  const remind = note?.remindAt ? new Date(note.remindAt) : null;
  return {
    body: note?.body ?? '',
    title: note?.title ?? '',
    tagId: note ? note.tagId : defaultTagId,
    pinned: note?.pinned ?? false,
    isPrivate: note?.isPrivate ?? false,
    remindDate: remind
      ? `${remind.getFullYear()}-${pad(remind.getMonth() + 1)}-${pad(remind.getDate())}`
      : '',
    remindTime:
      remind && note?.remindHasTime ? `${pad(remind.getHours())}:${pad(remind.getMinutes())}` : '',
    byName: note ? '' : readLastWho(),
  };
}

/** Fecha (y hora opcional) local del dispositivo → instante ISO. Sin hora = inicio del día. */
function remindToIso(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

interface NoteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nota a editar; null = crear. */
  note: Note | null;
  tags: NoteTag[];
  /** Etiqueta propuesta al crear (la del filtro activo). */
  defaultTagId: string | null;
  isSharedAccount: boolean;
  currentUserId: string | undefined;
}

/** Abre el calendario o el reloj al tocar cualquier parte del campo, no solo el icono. */
function openNativePicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Navegadores antiguos o sin gesto válido: se queda el comportamiento nativo.
  }
}

export function NoteFormModal({
  open,
  onOpenChange,
  note,
  tags,
  defaultTagId,
  isSharedAccount,
  currentUserId,
}: NoteFormModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(note, defaultTagId));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = note ? note.id : '__new__';
  // El modal se reutiliza: resincroniza el formulario al abrirse para otra nota.
  if (open && openedFor !== key) {
    setOpenedFor(key);
    setForm(toFormState(note, defaultTagId));
  } else if (!open && openedFor !== null) {
    setOpenedFor(null);
  }

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const addNotification = useNotification();
  const saving = createNote.isPending || updateNote.isPending;
  const isEditing = Boolean(note);
  // «Solo para mí»: solo cuenta personal y, al editar, solo su autor.
  const canTogglePrivate = !isSharedAccount && (!note || note.createdBy === currentUserId);
  const needsWho = isSharedAccount && !isEditing;

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.body.trim()) {
      addNotification({ type: 'error', title: 'Falta el texto', message: 'Escribe la nota.' });
      return;
    }
    if (needsWho && !form.byName.trim()) {
      addNotification({ type: 'error', title: 'Falta quién', message: 'Indica tu nombre.' });
      return;
    }
    const payload: NoteInput = {
      body: form.body.trim(),
      title: form.title.trim() || null,
      tagId: form.tagId,
      pinned: form.pinned,
      remindAt: remindToIso(form.remindDate, form.remindTime),
      remindHasTime: Boolean(form.remindDate && form.remindTime),
      ...(canTogglePrivate && { isPrivate: form.isPrivate }),
    };
    try {
      if (note) {
        await updateNote.mutateAsync({ id: note.id, ...payload });
      } else {
        // Al crear, los vacíos se omiten en vez de mandarse como null.
        const byName = needsWho ? form.byName.trim() : undefined;
        if (byName) rememberWho(byName);
        await createNote.mutateAsync({
          ...payload,
          title: payload.title ?? undefined,
          tagId: payload.tagId ?? undefined,
          remindAt: payload.remindAt ?? undefined,
          byName,
        });
      }
      onOpenChange(false);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: resolveErrorMessage(error, 'Inténtalo de nuevo.'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar nota' : 'Nueva nota'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            autoFocus={!isEditing}
            aria-label="Texto de la nota"
            rows={5}
            maxLength={5000}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="Ej. Congelador 2: 3 bolsas de fondo de ternera, 2 kg de rabo…"
            className="text-base"
          />

          {tags.length > 0 && (
            <div className="space-y-1.5">
              <Label>Etiqueta</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Etiqueta">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.tagId === null}
                  onClick={() => set('tagId', null)}
                  className={`min-h-10 rounded-full border px-3 text-label-md ${
                    form.tagId === null
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-on-surface-variant'
                  }`}
                >
                  Sin etiqueta
                </button>
                {tags.map((tag) => {
                  const selected = form.tagId === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set('tagId', tag.id)}
                      className={`min-h-10 rounded-full border-2 px-3 text-label-md ${
                        NOTE_COLOR_CLASSES[tag.color].chip
                      } ${selected ? 'border-primary' : 'border-transparent'}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {needsWho && (
            <div className="space-y-1.5">
              <Label htmlFor="note-who">¿Quién eres? *</Label>
              <Input
                id="note-who"
                value={form.byName}
                maxLength={80}
                onChange={(e) => set('byName', e.target.value)}
                placeholder="Tu nombre"
                className="text-base"
              />
            </div>
          )}

          <details className="rounded-md border border-border px-3 py-2" open={isEditing || undefined}>
            <summary className="cursor-pointer select-none py-1 text-label-md text-on-surface-variant">
              Más opciones: título, aviso, fijar
            </summary>
            <div className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="note-title">Título (opcional)</Label>
                <Input
                  id="note-title"
                  value={form.title}
                  maxLength={120}
                  onChange={(e) => set('title', e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="note-remind-date">Avisar el día</Label>
                  <Input
                    id="note-remind-date"
                    type="date"
                    value={form.remindDate}
                    onChange={(e) => set('remindDate', e.target.value)}
                    onClick={openNativePicker}
                    className="cursor-pointer text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note-remind-time">Hora (opcional)</Label>
                  <Input
                    id="note-remind-time"
                    type="time"
                    value={form.remindTime}
                    disabled={!form.remindDate}
                    onChange={(e) => set('remindTime', e.target.value)}
                    onClick={openNativePicker}
                    className="cursor-pointer text-base"
                  />
                </div>
              </div>
              {form.remindDate && (
                <button
                  type="button"
                  className="text-label-md text-primary underline"
                  onClick={() => setForm((prev) => ({ ...prev, remindDate: '', remindTime: '' }))}
                >
                  Quitar aviso
                </button>
              )}

              <label className="flex items-center justify-between gap-3">
                <span className="text-body-md">Fijar arriba</span>
                <Switch checked={form.pinned} onCheckedChange={(v) => set('pinned', Boolean(v))} />
              </label>

              {canTogglePrivate && (
                <label className="flex items-center justify-between gap-3">
                  <span className="text-body-md">
                    Solo para mí
                    <span className="block text-label-sm text-on-surface-variant">
                      Nadie más la ve, tampoco gerencia.
                    </span>
                  </span>
                  <Switch
                    checked={form.isPrivate}
                    onCheckedChange={(v) => set('isPrivate', Boolean(v))}
                  />
                </label>
              )}
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
