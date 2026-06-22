import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategories, useCategoryTree, Category, CategoryTreeNode } from '@/hooks/use-categories';
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-category-mutations';
import { CategoryTreeView } from './category-tree-view';
import { CategoryForm } from './category-form';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoriesManagementModal({ isOpen, onClose }: Props) {
  const { data: categories, isLoading } = useCategories('articles');
  const { data: tree } = useCategoryTree('articles');
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [activeTab, setActiveTab] = useState('list');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Eliminar categoría "${name}"? Los artículos en esta categoría quedarán sin categoría.`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        alert(error.message || 'Error al eliminar categoría');
      }
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

  const handleSubmit = async (data: any) => {
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setActiveTab('list');
      setEditingCategory(null);
    } catch (error: any) {
      alert(error.message || 'Error al guardar categoría');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Categorías</DialogTitle>
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