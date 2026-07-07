import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCategories,
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  Category,
  CategoryContext,
} from '@/hooks/use-categories';
import { slugify } from '@/lib/utils';
import { CategoryTreeView } from './category-tree-view';
import { CategoryForm, CategoryFormData } from './category-form';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Catálogo a gestionar: 'articles' (inventario) o 'recipes' (platos). */
  context: CategoryContext;
}

const DELETE_WARNING: Record<CategoryContext, string> = {
  articles: 'Los artículos en esta categoría quedarán sin categoría.',
  recipes: 'Las recetas perderán esta categoría.',
};

export function CategoriesManagementModal({ isOpen, onClose, context }: Props) {
  const { data: categories, isLoading } = useCategories(context);
  const { data: tree } = useCategoryTree(context);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const addNotification = useNotification();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('list');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Eliminar categoría',
      description: `¿Eliminar "${name}"? ${DELETE_WARNING[context]}`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'Error al eliminar categoría',
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setActiveTab('form');
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setActiveTab('form');
  };

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      if (editingCategory) {
        // parentId '' (opción "Sin categoría padre") → null para desvincular en backend
        await updateMutation.mutateAsync({
          id: editingCategory.id,
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          isActive: data.isActive,
          parentId: data.parentId || null,
        });
      } else {
        // El backend exige slug único por tenant+context y rechaza campos no permitidos
        await createMutation.mutateAsync({
          name: data.name,
          slug: slugify(data.name),
          context,
          description: data.description || undefined,
          icon: data.icon,
          color: data.color,
          isActive: data.isActive,
          parentId: data.parentId || undefined,
        });
      }
      setActiveTab('list');
      setEditingCategory(null);
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'Error al guardar categoría',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {context === 'recipes' ? 'Categorías de recetas' : 'Categorías de artículos'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Árbol ({categories?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="form">
              {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {categories?.filter(c => c.isActive).length ?? 0} activas de {categories?.length ?? 0} totales
              </p>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva categoría
              </Button>
            </div>

            {isLoading ? (
              <p className="text-center py-8">Cargando...</p>
            ) : (
              <div className="border rounded-lg p-4 bg-white">
                <CategoryTreeView
                  tree={tree ?? []}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="form">
            <CategoryForm
              category={editingCategory}
              tree={tree ?? []}
              onSubmit={handleSubmit}
              onCancel={() => setActiveTab('list')}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
