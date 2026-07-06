'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { ApiError } from '@/types/api.types';
import apiClient from '@/lib/api-client';
import { slugify } from '@/lib/utils';
import { Category, CategoryContext, CategoryTreeNode } from '@/hooks/use-categories';

interface CategoryQuickCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (category: Category) => void;
  /** Árbol de categorías del contexto (para ofrecer padres en el select). */
  tree: CategoryTreeNode[];
  /** Catálogo al que añadir la categoría: 'articles' (inventario) o 'recipes'. */
  context?: CategoryContext;
}

/**
 * Diálogo ligero para crear una categoría (o subcategoría, si se elige padre)
 * sin abandonar el formulario de artículo. Espejo de SupplierQuickCreateDialog.
 */
export default function CategoryQuickCreateDialog({
  isOpen,
  onClose,
  onCreated,
  tree,
  context = 'articles',
}: CategoryQuickCreateDialogProps) {
  const addNotification = useNotification();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setName('');
    setParentId('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      addNotification({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' });
      return;
    }

    setSaving(true);
    try {
      // CreateCategoryDto exige {name, slug, context}; forbidNonWhitelisted descarta el resto.
      // parentId opcional → si se elige, la nueva categoría cuelga de ese padre (subcategoría).
      const response = await apiClient.post('/v1/categories', {
        name: name.trim(),
        slug: slugify(name.trim()),
        context,
        parentId: parentId || undefined,
      });
      const created = (response.data?.data || response.data) as Category;

      // Refresca listados, árbol y filtros que consumen la query de categorías.
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      addNotification({
        type: 'success',
        title: parentId ? 'Subcategoría creada' : 'Categoría creada',
        message: `"${name.trim()}" añadida correctamente`,
      });
      onCreated(created);

      reset();
      onClose();
    } catch (error: unknown) {
      const message = axios.isAxiosError<ApiError>(error)
        ? (error.response?.data?.message || error.message || 'Error al crear categoría')
        : (error instanceof Error ? error.message : 'Error al crear categoría');
      addNotification({ type: 'error', title: 'Error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600/50 z-[60] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {parentId ? 'Nueva subcategoría' : 'Nueva categoría'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría padre <span className="text-gray-400 text-xs">(opcional)</span>
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
            >
              <option value="">Sin categoría padre (categoría principal)</option>
              {tree.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Si eliges un padre, se creará como subcategoría de éste.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Crear categoría
          </button>
        </div>
      </div>
    </div>
  );
}
