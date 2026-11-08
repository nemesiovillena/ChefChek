'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { readLastWho, rememberWho } from './note-display';

interface NoteWhoDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

/** En un dispositivo compartido, pregunta quién marca la nota como hecha. */
export function NoteWhoDialog({ open, onCancel, onConfirm }: NoteWhoDialogProps) {
  const [name, setName] = useState('');
  const [wasOpen, setWasOpen] = useState(false);
  // Al abrir, propone el último nombre usado en este dispositivo.
  if (open && !wasOpen) {
    setWasOpen(true);
    setName(readLastWho());
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    rememberWho(trimmed);
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Quién la marca como hecha?</DialogTitle>
          <DialogDescription>Queda apuntado quién y cuándo.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          maxLength={80}
          placeholder="Tu nombre"
          className="text-base"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!name.trim()}>
            Hecha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
