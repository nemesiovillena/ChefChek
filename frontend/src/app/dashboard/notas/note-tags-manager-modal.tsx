'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { resolveErrorMessage } from '@/hooks/use-api';
import {
  NOTE_TAG_COLORS,
  useCreateNoteTag,
  useDeleteNoteTag,
  useReorderNoteTags,
  useUpdateNoteTag,
  type NoteTag,
  type NoteTagColor,
} from '@/hooks/use-notes';
import { NOTE_COLOR_CLASSES } from './note-display';

function ColorPicker({
  value,
  onChange,
}: {
  value: NoteTagColor;
  onChange: (color: NoteTagColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
      {NOTE_TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={NOTE_COLOR_CLASSES[color].label}
          title={NOTE_COLOR_CLASSES[color].label}
          onClick={() => onChange(color)}
          className={`h-8 w-8 rounded-full ${NOTE_COLOR_CLASSES[color].swatch} ${
            value === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
          }`}
        />
      ))}
    </div>
  );
}

/** Una fila: nombre editable (se guarda al salir del campo), color, subir/bajar y borrar. */
function TagRow({
  tag,
  isFirst,
  isLast,
  onMove,
}: {
  tag: NoteTag;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const [name, setName] = useState(tag.name);
  const updateTag = useUpdateNoteTag();
  const deleteTag = useDeleteNoteTag();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const fail = (error: unknown) =>
    addNotification({
      type: 'error',
      title: 'No se pudo guardar',
      message: resolveErrorMessage(error, 'Inténtalo de nuevo.'),
    });

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      setName(tag.name);
      return;
    }
    try {
      await updateTag.mutateAsync({ id: tag.id, name: trimmed });
    } catch (error) {
      setName(tag.name);
      fail(error);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Borrar la etiqueta «${tag.name}»`,
      description: 'Sus notas no se borran: se quedan sin etiqueta.',
      confirmText: 'Borrar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteTag.mutateAsync(tag.id);
    } catch (error) {
      fail(error);
    }
  };

  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Nombre de la etiqueta"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="text-base"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label="Subir"
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label="Bajar"
        >
          <span className="material-symbols-outlined">arrow_downward</span>
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={remove} aria-label="Borrar etiqueta">
          <span className="material-symbols-outlined">delete</span>
        </Button>
      </div>
      <ColorPicker
        value={tag.color}
        onChange={(color) => updateTag.mutateAsync({ id: tag.id, color }).catch(fail)}
      />
    </li>
  );
}

interface NoteTagsManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: NoteTag[];
}

/** Gerencia: crear, renombrar, colorear, ordenar y borrar etiquetas. */
export function NoteTagsManagerModal({ open, onOpenChange, tags }: NoteTagsManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<NoteTagColor>('violet');
  const createTag = useCreateNoteTag();
  const reorderTags = useReorderNoteTags();
  const addNotification = useNotification();

  const move = (index: number, direction: -1 | 1) => {
    const ids = tags.map((t) => t.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderTags.mutate(ids);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createTag.mutateAsync({ name, color: newColor });
      setNewName('');
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'No se pudo crear',
        message: resolveErrorMessage(error, 'Inténtalo de nuevo.'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Etiquetas de notas</DialogTitle>
          <DialogDescription>El orden de aquí es el de los filtros.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {tags.map((tag, index) => (
            <TagRow
              // La clave incluye el nombre para que la fila se reinicie si cambia fuera.
              key={`${tag.id}:${tag.name}`}
              tag={tag}
              isFirst={index === 0}
              isLast={index === tags.length - 1}
              onMove={(direction) => move(index, direction)}
            />
          ))}
        </ul>

        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex gap-2">
            <Input
              aria-label="Nueva etiqueta"
              placeholder="Nueva etiqueta"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              className="text-base"
            />
            <Button type="button" onClick={create} disabled={!newName.trim() || createTag.isPending}>
              Añadir
            </Button>
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
