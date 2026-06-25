'use client';

import { useState, useRef, useEffect } from 'react';
import { updateLine } from '@/lib/api-albaran';
import { Loader2, Pencil } from 'lucide-react';

interface EditableLineCellProps {
  albaranId: string;
  lineId: string;
  field: string;
  value: string | number;
  type?: 'text' | 'number';
  step?: string;
  suffix?: string;
  className?: string;
  format?: (v: any) => string;
  onSave?: () => void;
}

/**
 * Celda de tabla editable inline.
 * Click → input, blur/Enter → guarda vía API.
 */
export function EditableLineCell({
  albaranId,
  lineId,
  field,
  value,
  type = 'text',
  step,
  suffix,
  className = '',
  format,
  onSave,
}: EditableLineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(String(value ?? ''));
    setEditing(true);
  };

  const save = async () => {
    setEditing(false);
    const cleanDraft = draft.trim();
    const original = String(value ?? '');

    // No guardar si no cambió
    if (cleanDraft === original) return;

    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      payload[field] = type === 'number' ? parseFloat(cleanDraft) || 0 : cleanDraft;
      await updateLine(albaranId, lineId, payload);
      onSave?.();
    } catch (err) {
      console.error('Error saving:', err);
      // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  // Display mode
  if (!editing) {
    return (
      <span
        className={`group cursor-pointer inline-flex items-center gap-1 ${className}`}
        onClick={startEdit}
        title="Click para editar"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        ) : (
          <>
            <span>{format ? format(value) : (value ?? '—')}</span>
            {suffix && <span className="text-gray-400">{suffix}</span>}
            <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </span>
    );
  }

  // Edit mode
  return (
    <input
      ref={inputRef}
      type={type}
      step={step}
      min={type === 'number' ? '0' : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      className="h-7 w-full px-1 text-sm border border-indigo-400 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}
