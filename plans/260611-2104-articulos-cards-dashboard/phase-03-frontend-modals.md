---
phase: 3
title: "Frontend Modals"
status: pending
priority: P2
effort: "8-10h"
dependencies: [1, 2]
---

# Phase 3: Frontend Management Modals

## Overview

Implementar dos modals complejos de gestión: SuppliersManagementModal (CRUD completo, price trends badges, ver productos) y CategoriesManagementModal (árbol jerárquico, CRUD, reordenar). Integrar con cards de Phase 2.

## Requirements

### Functional

**Suppliers Modal:**
- Listado de todos los proveedores en tabla
- Badges de precio: 🔴↑ (subió), 🟢↓ (bajó), ⚪ (sin cambios)
- CRUD completo: crear, editar, eliminar (validar no tiene productos)
- Toggle activo/inactivo rápido en tabla
- Ver productos del proveedor (abre lista filtrada)
- Formulario completo con todos los campos del modelo

**Categories Modal:**
- Vista de árbol jerárquico (padre → hijos)
- Solo categorías con context="articles"
- CRUD completo: crear, editar, eliminar (validar subcategorías/productos)
- Opción "mover artículos a otra categoría" al eliminar
- Reordenar categorías (drag & drop o botones)
- Icono (selector Lucide) y color (picker)

### Non-functional
- Performance: listados paginados si > 50 items
- Accessibility: keyboard navigation, aria labels
- UX: validaciones en tiempo real, mensajes de error claros
- Responsive: full-screen en móvil, centrado en desktop

## Architecture

```
frontend/src/app/dashboard/articulos/components/
├── suppliers-management-modal.tsx (nuevo)
│   ├── SupplierListTable
│   ├── SupplierForm (crear/editar)
│   ├── SupplierPriceTrendBadge
│   └── SupplierProductsList
└── categories-management-modal.tsx (nuevo)
    ├── CategoryTreeView
    ├── CategoryForm (crear/editar)
    ├── CategoryIconSelector
    ├── CategoryColorPicker
    └── CategoryReorderControls
```

Data flow:
```
SuppliersManagementModal
├── useSuppliers() → lista proveedores
├── useMutation() → crear/actualizar/eliminar proveedor
└── useSupplierPriceTrend(id) → badge de tendencia

CategoriesManagementModal
├── useCategories() → árbol categorías
├── useMutation() → crear/actualizar/eliminar categoría
└── useCategoryProductCount(id) → contador productos
```

## Related Code Files

### Create
- `frontend/src/app/dashboard/articulos/components/suppliers-management-modal.tsx`
- `frontend/src/app/dashboard/articulos/components/categories-management-modal.tsx`
- `frontend/src/hooks/use-supplier-mutations.ts`
- `frontend/src/hooks/use-category-mutations.ts`

### Modify
- `frontend/src/app/dashboard/articulos/page.tsx` (integrar modals)
- `frontend/src/hooks/use-categories.ts` (agregar useCategoryProductCount)

## Implementation Steps

### Step 1: Supplier Price Trend Badge (1.5h)

1. Crear componente `frontend/src/app/dashboard/articulos/components/supplier-price-trend-badge.tsx`:

```typescript
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Props {
  supplierId: string;
}

interface PriceTrend {
  status: 'increased' | 'decreased' | 'stable';
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}

export function SupplierPriceTrendBadge({ supplierId }: Props) {
  const { data, isLoading } = useQuery<PriceTrend>({
    queryKey: ['supplier-price-trend', supplierId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/suppliers/${supplierId}/price-trend`);
      if (!res.ok) throw new Error('Failed to fetch price trend');
      return res.json();
    }
  });

  if (isLoading) return <span className="text-gray-400 text-xs">Cargando...</span>;
  if (!data) return null;

  const { status, percentage, lastPrice, currentPrice } = data;

  const configs = {
    increased: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: TrendingUp,
      label: 'Subió'
    },
    decreased: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: TrendingDown,
      label: 'Bajó'
    },
    stable: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: Minus,
      label: 'Sin cambios'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', config.bg, config.text)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {status !== 'stable' && <span>({percentage.toFixed(1)}%)</span>}
    </div>
  );
}
```

### Step 2: Supplier Mutations Hook (1h)

1. Crear `frontend/src/hooks/use-supplier-mutations.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSupplierDto) => {
      const res = await fetch('/api/v1/products/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create supplier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    }
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSupplierDto }) => {
      const res = await fetch(`/api/v1/products/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update supplier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    }
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/products/suppliers/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete supplier');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    }
  });
}

export function useToggleSupplierActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/products/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error('Failed to toggle supplier status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    }
  });
}
```

### Step 3: Supplier Form Component (1.5h)

1. Crear `frontend/src/app/dashboard/articulos/components/supplier-form.tsx` (usar dentro de modal):

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  supplier?: Supplier | null;
  onSubmit: (data: CreateSupplierDto | UpdateSupplierDto) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function SupplierForm({ supplier, onSubmit, onCancel, isSubmitting }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: supplier || {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      website: '',
      averageDeliveryTime: 3,
      reliabilityScore: 85,
      priceTier: 'MEDIUM',
      preferredStatus: 'ALTERNATIVE',
      orderMethods: ['EMAIL'],
      isActive: true
    }
  });

  const [selectedMethods, setSelectedMethods] = useState<string[]>(supplier?.orderMethods || ['EMAIL']);

  const toggleMethod = (method: string) => {
    setSelectedMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input {...register('name', { required: 'Nombre requerido' })} placeholder="Proveedor S.L." />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Persona de contacto</label>
          <Input {...register('contactPerson')} placeholder="Juan Pérez" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input {...register('email')} type="email" placeholder="contacto@proveedor.com" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input {...register('phone')} placeholder="+34 600 123 456" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <Input {...register('website')} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Entrega media (días)</label>
          <Input {...register('averageDeliveryTime', { valueAsNumber: true })} type="number" min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fiabilidad (0-100)</label>
          <Input {...register('reliabilityScore', { valueAsNumber: true })} type="number" min="0" max="100" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nivel precios</label>
          <Select {...register('priceTier')}>
            <option value="LOW">Bajo</option>
            <option value="MEDIUM">Medio</option>
            <option value="HIGH">Alto</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Estado preferido</label>
          <Select {...register('preferredStatus')}>
            <option value="PREFERRED">Preferido</option>
            <option value="ALTERNATIVE">Alternativo</option>
            <option value="EXCLUDED">Excluido</option>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Métodos de pedido</label>
        <div className="flex gap-3">
          {(['EMAIL', 'PHONE', 'WEB'] as const).map(method => (
            <label key={method} className="flex items-center gap-2">
              <Checkbox
                checked={selectedMethods.includes(method)}
                onCheckedChange={() => toggleMethod(method)}
              />
              <span className="text-sm">{method}</span>
            </label>
          ))}
        </div>
        <input type="hidden" {...register('orderMethods')} value={JSON.stringify(selectedMethods)} />
      </div>

      <div className="flex items-center gap-2 pt-4 border-t">
        <Checkbox {...register('isActive')} id="isActive" />
        <label htmlFor="isActive" className="text-sm">Proveedor activo</label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : supplier ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
```

### Step 4: Suppliers Management Modal (2.5h)

1. Crear `frontend/src/app/dashboard/articulos/components/suppliers-management-modal.tsx`:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useToggleSupplierActive } from '@/hooks/use-supplier-mutations';
import { SupplierPriceTrendBadge } from './supplier-price-trend-badge';
import { SupplierForm } from './supplier-form';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SuppliersManagementModal({ isOpen, onClose }: Props) {
  const { data: suppliers, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplierActive();

  const [activeTab, setActiveTab] = useState('list');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Eliminar proveedor "${name}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error: any) {
        alert(error.message || 'Error al eliminar proveedor');
      }
    }
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      await toggleMutation.mutateAsync({ id: supplier.id, isActive: !supplier.isActive });
    } catch (error: any) {
      alert(error.message || 'Error al cambiar estado');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setActiveTab('form');
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setActiveTab('form');
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setActiveTab('list');
      setEditingSupplier(null);
    } catch (error: any) {
      alert(error.message || 'Error al guardar proveedor');
    }
  };

  const handleViewProducts = (supplier: Supplier) => {
    // TODO: Implementar vista de productos del proveedor
    console.log('View products for supplier:', supplier.id);
    alert('Funcionalidad: Filtrar artículos por proveedor en tabla principal');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de Proveedores</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Listado ({suppliers?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="form">
              {editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {suppliers?.filter(s => s.isActive).length ?? 0} activos de {suppliers?.length ?? 0} totales
              </p>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo proveedor
              </Button>
            </div>

            {isLoading ? (
              <p className="text-center py-8">Cargando...</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left font-medium">Contacto</th>
                      <th className="px-4 py-2 text-left font-medium">Estado</th>
                      <th className="px-4 py-2 text-left font-medium">Tendencia</th>
                      <th className="px-4 py-2 text-left font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers?.map(supplier => (
                      <tr key={supplier.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{supplier.name}</td>
                        <td className="px-4 py-2 text-gray-600">
                          <div className="space-y-1">
                            {supplier.contactPerson && <p>{supplier.contactPerson}</p>}
                            {supplier.email && <p className="text-xs text-gray-500">{supplier.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(supplier)}
                            className={supplier.isActive ? 'text-green-600' : 'text-gray-400'}
                          >
                            {supplier.isActive ? 'Activo' : 'Inactivo'}
                          </Button>
                        </td>
                        <td className="px-4 py-2">
                          <SupplierPriceTrendBadge supplierId={supplier.id} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewProducts(supplier)}>
                              Productos
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}>
                              Editar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id, supplier.name)}>
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="form">
            <SupplierForm
              supplier={editingSupplier}
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
```

### Step 5: Category Mutations Hook (1h)

1. Crear `frontend/src/hooks/use-category-mutations.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryDto) => {
      const res = await fetch('/api/v1/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, context: 'articles' })
      });
      if (!res.ok) throw new Error('Failed to create category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
    }
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCategoryDto }) => {
      const res = await fetch(`/api/v1/products/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/products/categories/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
    }
  });
}
```

### Step 6: Category Tree View Component (1.5h)

1. Crear `frontend/src/app/dashboard/articulos/components/category-tree-view.tsx`:

```typescript
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface Props {
  tree: CategoryTreeNode[];
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
}

export function CategoryTreeView({ tree, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-1">
      {tree.map(node => (
        <CategoryTreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function CategoryTreeNodeComponent({
  node,
  level,
  onEdit,
  onDelete
}: {
  node: CategoryTreeNode;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 16;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer group"
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {node.icon && (
          <span className="text-lg" role="img" aria-label={node.name}>
            {node.icon}
          </span>
        )}

        {node.color && (
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
        )}

        <span className="flex-1 font-medium text-sm">{node.name}</span>

        {!node.isActive && (
          <span className="text-xs text-gray-400">Inactivo</span>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onEdit(node as Category)}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-red-600"
            onClick={() => onDelete(node.id, node.name)}
          >
            Eliminar
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <CategoryTreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 7: Categories Management Modal (1.5h)

1. Crear `frontend/src/app/dashboard/articulos/components/categories-management-modal.tsx`:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCategories, useCategoryTree } from '@/hooks/use-categories';
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
```

### Step 8: Category Form Component (1h)

1. Crear `frontend/src/app/dashboard/articulos/components/category-form.tsx`:

```typescript
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Props {
  category?: Category | null;
  tree: CategoryTreeNode[];
  onSubmit: (data: CreateCategoryDto | UpdateCategoryDto) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// Emojis simples como iconos predefinidos
const ICONS = ['🍎', '🥬', '🥩', '🐟', '🥛', '🧀', '🥚', '🥖', '🍝', '🍕', '🥗', '🍲', '☕', '🍵', '🍬', '🧂'];

export function CategoryForm({ category, tree, onSubmit, onCancel, isSubmitting }: Props) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: category || {
      name: '',
      description: '',
      icon: '📁',
      color: '#6366f1',
      parentId: '',
      sortOrder: 0,
      isActive: true
    }
  });

  const parentId = watch('parentId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input {...register('name', { required: 'Nombre requerido' })} placeholder="Verduras" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <Input {...register('description')} placeholder="Categoría para vegetales frescos" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Icono</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => register('icon').onChange({ target: { value: icon } })}
                className={`w-10 h-10 text-2xl rounded-lg border-2 ${
                  watch('icon') === icon ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input
            type="color"
            {...register('color')}
            className="w-full h-10 rounded-lg border"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Categoría padre</label>
        <Select {...register('parentId')}>
          <option value="">Sin categoría padre</option>
          {tree.map(node => (
            <option key={node.id} value={node.id}>
              {'  '.repeat(0)}{node.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
```

### Step 9: Integrate Modals into Artículos Page (1h)

1. Modificar `frontend/src/app/dashboard/articulos/page.tsx`:

```typescript
// Agregar imports
import { SuppliersManagementModal } from './components/suppliers-management-modal';
import { CategoriesManagementModal } from './components/categories-management-modal';

// Agregar state
const [showSuppliersModal, setShowSuppliersModal] = useState(false);
const [showCategoriesModal, setShowCategoriesModal] = useState(false);

// Actualizar handlers
const handleManageSuppliers = () => setShowSuppliersModal(true);
const handleManageCategories = () => setShowCategoriesModal(true);

// En el JSX, antes de closing tags
<SuppliersManagementModal
  isOpen={showSuppliersModal}
  onClose={() => setShowSuppliersModal(false)}
/>

<CategoriesManagementModal
  isOpen={showCategoriesModal}
  onClose={() => setShowCategoriesModal(false)}
/>
```

## Success Criteria

- [ ] Suppliers Modal funciona: listar, crear, editar, eliminar
- [ ] Badge de tendencia de precio muestra correctamente 🔴↑, 🟢↓, ⚪
- [ ] Toggle activo/inactivo funciona en tiempo real
- [ ] "Ver productos" de proveedor filtra tabla principal
- [ ] Categories Modal funciona: árbol, crear, editar, eliminar
- [ ] Categorías solo muestran context="articles"
- [ ] Icono y color de categoría se guardan y muestran
- [ ] Validaciones: no eliminar proveedor con productos, no eliminar categoría con subcategorías
- [ ] No errores TypeScript
- [ ] Modals cerrar con Escape y click fuera

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance modal con muchos items | Medium | Low | Implementar paginación si > 50 |
| Validación ciclos jerarquía falla | Low | Medium | Usar lógica existente de useCategoryTree |
| Price trend badge no actualiza | Low | Low | Refetch automático TanStack Query |

## Related Files in Other Phases

- Phase 1: Endpoints CRUD y extras usados por modals
- Phase 2: Cards integran con modals (onManageSuppliers, onManageCategories)
- Phase 4: Tests de modals