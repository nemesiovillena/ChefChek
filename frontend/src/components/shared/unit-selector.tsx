'use client';

import { useState } from 'react';
import { useUnits, useCreateUnit, type UnitOfMeasure } from '@/hooks/use-units';
import { Plus, Loader2 } from 'lucide-react';

interface UnitSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Selector de unidades de medida reutilizable.
 * Carga las unidades del tenant desde la API y permite crear nuevas inline.
 * Usa `symbol` como valor (coincide con Product.referenceUnit y AlbaranLine.unit).
 */
export function UnitSelector({ value, onChange, className = '', placeholder = 'Unidad' }: UnitSelectorProps) {
  const { data: units, isLoading } = useUnits();
  const createUnit = useCreateUnit();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [isSymbolManuallyEdited, setIsSymbolManuallyEdited] = useState(false);

  const generateSymbol = (name: string): string => {
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, '')       // Keep only alphanumeric chars
      .substring(0, 5);                // Max 5 chars
  };

  const handleNameChange = (val: string) => {
    setNewName(val);
    if (!isSymbolManuallyEdited) {
      setNewSymbol(generateSymbol(val));
    }
  };

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    let trimmedSymbol = newSymbol.trim();

    if (!trimmedName) return;

    if (!trimmedSymbol) {
      trimmedSymbol = generateSymbol(trimmedName);
    }

    if (!trimmedSymbol) return;

    try {
      const result = await createUnit.mutateAsync({
        name: trimmedName,
        symbol: trimmedSymbol,
      });
      onChange(result.symbol);
      setShowCreate(false);
      setNewName('');
      setNewSymbol('');
      setIsSymbolManuallyEdited(false);
    } catch (_e) {
      // Handled by React Query's error state
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border rounded-md bg-gray-50 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Cargando...</span>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Nombre (ej: Docena)"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => {
              setNewSymbol(e.target.value);
              setIsSymbolManuallyEdited(true);
            }}
            placeholder="Símbolo (ej: doc)"
            className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleCreate}
            disabled={createUnit.isPending || !newName.trim()}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {createUnit.isPending ? 'Creando...' : 'Crear'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName('');
              setNewSymbol('');
              setIsSymbolManuallyEdited(false);
            }}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
        {createUnit.isError && (
          <p className="text-xs text-red-600">{createUnit.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-1 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
      >
        <option value="">{placeholder}</option>
        {units?.map((unit: UnitOfMeasure) => (
          <option key={unit.id} value={unit.symbol}>
            {unit.name} ({unit.symbol})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="px-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-500 hover:text-indigo-600"
        title="Crear nueva unidad"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
