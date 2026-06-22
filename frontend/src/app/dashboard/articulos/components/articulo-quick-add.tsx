'use client';

import { useState } from 'react';
import { useNotification } from '@/components/notification-system';
import { useCreateProduct } from '@/hooks/use-products';
import { CategoryTreeNode } from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import CategoryCombobox from './category-combobox';

interface ArticuloQuickAddProps {
  tree: CategoryTreeNode[];
  onCreated: () => void;
  onOpenFull: () => void;
}

/** Inline quick-add form: name + category minimum, creates draft article */
export default function ArticuloQuickAdd({ tree, onCreated, onOpenFull }: ArticuloQuickAddProps) {
  const addNotification = useNotification();
  const createMutation = useCreateProduct();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [referenceUnit, setReferenceUnit] = useState('kg');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' });
      return;
    }

    setSaving(true);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        referenceUnit,
        category: categoryId || undefined,
      });
      addNotification({ type: 'success', title: 'Artículo creado', message: `"${name}" añadido como borrador` });
      setName('');
      setCategoryId('');
      setExpanded(false);
      onCreated();
    } catch (error: any) {
      addNotification({ type: 'error', title: 'Error', message: error.message || 'Error al crear artículo' });
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Añadir artículo rápido...
      </button>
    );
  }

  return (
    <div className="border border-indigo-200 rounded-lg bg-indigo-50/30 p-3 flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del artículo"
          className="h-8 text-sm"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
      </div>
      <div className="w-[180px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
        <CategoryCombobox
          tree={tree}
          value={categoryId}
          onValueChange={setCategoryId}
          placeholder="Categoría"
        />
      </div>
      <div className="w-[80px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
        <select
          value={referenceUnit}
          onChange={(e) => setReferenceUnit(e.target.value)}
          className="w-full h-8 text-sm border rounded-md px-2"
        >
          <option value="kg">kg</option>
          <option value="L">L</option>
          <option value="und">und</option>
        </select>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="h-8 gap-1">
        <Plus className="h-3.5 w-3.5" />
        {saving ? '...' : 'Añadir'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setExpanded(false)} className="h-8 text-xs">
        Cancelar
      </Button>
      <Button size="sm" variant="link" onClick={onOpenFull} className="h-8 text-xs text-indigo-600">
        Formulario completo
      </Button>
    </div>
  );
}
