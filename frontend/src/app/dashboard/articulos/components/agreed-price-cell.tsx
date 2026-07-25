'use client';

import { useState } from 'react';
import { Tags, Check, X, Copy } from 'lucide-react';
import { formatEuro } from '@/lib/utils';

interface AgreedPriceCellProps {
  agreedPrice: number | null;
  currentPrice: number;
  isSaving: boolean;
  onSave: (value: number | null) => void;
  /** Solo lectura: sin botones de editar/1-clic/limpiar. Default false. */
  readOnly?: boolean;
}

/** Precio pactado de una oferta de proveedor (control de desviaciones, módulo Compras):
 * ver/editar/limpiar manualmente, o fijarlo con 1 clic al precio actual de la oferta. */
export function AgreedPriceCell({ agreedPrice, currentPrice, isSaving, onSave, readOnly = false }: AgreedPriceCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState('');

  const startEdit = () => {
    setInput(agreedPrice != null ? String(agreedPrice) : '');
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = input.trim();
    const value = trimmed === '' ? null : parseFloat(trimmed);
    if (value !== null && (isNaN(value) || value < 0)) return;
    onSave(value);
    setIsEditing(false);
  };

  if (readOnly) {
    return (
      <div className="mt-1.5 flex items-center gap-2 pl-6">
        <Tags className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="text-xs text-gray-500">
          {agreedPrice != null ? `Pactado: ${formatEuro(agreedPrice)}` : 'Sin pactar'}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 pl-6">
      <Tags className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {isEditing ? (
        <>
          <input
            type="number"
            step="0.001"
            min="0"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            placeholder="Sin pactar"
            className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button type="button" onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-700" title="Guardar">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={startEdit} className="text-xs text-gray-500 hover:text-indigo-600">
            {agreedPrice != null ? `Pactado: ${formatEuro(agreedPrice)}` : 'Fijar precio pactado'}
          </button>
          <button
            type="button"
            onClick={() => onSave(currentPrice)}
            disabled={isSaving}
            className="shrink-0 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
            title={`Usar precio actual (${formatEuro(currentPrice)})`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
