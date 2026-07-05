'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-system';
import {
  useRecipes,
  Recipe,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  RecipeIngredient,
  useRecipeCost,
} from '@/hooks/use-recipes';

type SubRecipeRow = { subRecipeId: string; quantity: number; unit: string };
import ElaborationStepEditor, {
  ElaborationStep,
  parseSteps,
  serializeSteps,
} from './components/elaboration-step-editor';
import { useProducts, Product } from '@/hooks/use-products';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { useCategories, Category } from '@/hooks/use-categories';
import { useAllergens } from '@/hooks/use-allergens';
import AllergenBadge from '@/components/shared/allergen-badge';
import AllergenIcon from '@/components/shared/allergen-icon';
import apiClient from '@/lib/api-client';
import { formatEuro } from '@/lib/utils';
import { CategoriesManagementModal } from '@/components/shared/categories-management-modal';

export const dynamic = 'force-dynamic';

export default function RecipesPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();

  const { data: recipesData, error: recipesError, refetch } = useRecipes();
  const recipes: Recipe[] = Array.isArray(recipesData?.data) ? recipesData.data : Array.isArray(recipesData) ? recipesData : [];

  const { data: productsData } = useProducts();
  const products: Product[] = Array.isArray(productsData?.data) ? productsData.data : Array.isArray(productsData) ? productsData : [];

  const { data: categoriesData } = useCategories("recipes");
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];

  // Catálogo de alérgenos para resolver ids → {nombre, icono} en la tabla.
  const { allergens: allergenCatalog } = useAllergens();
  const allergenById = useMemo(
    () => new Map(allergenCatalog.map((a) => [a.id, a] as const)),
    [allergenCatalog],
  );

  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const deleteRecipeMutation = useDeleteRecipe();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [activeMetaTab, setActiveMetaTab] = useState<'categories' | 'allergens'>('categories');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortField, setSortField] = useState<'name' | 'category' | 'totalCost' | 'costPerUnit'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<number[]>([]);
  const [generatingSheetId, setGeneratingSheetId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portions: '1',
    portionSize: '250',
  });

  const [elaborationSteps, setElaborationSteps] = useState<ElaborationStep[]>(() => parseSteps(null));

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { productId: '', productName: '', quantity: 0, unit: 'kg' },
  ]);

  const [subRecipes, setSubRecipes] = useState<SubRecipeRow[]>([]);

  // Handle authentication redirect in useEffect, not in render
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Don't render anything if not authenticated or loading
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Cargando recetas...</div>
      </div>
    );
  }

  if (recipesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600">Error al cargar recetas: {recipesError.message}</div>
      </div>
    );
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar la receta "${name}"?`)) {
      try {
        await deleteRecipeMutation.mutateAsync(id);
        addNotification({
          type: 'success',
          title: 'Receta eliminada',
          message: 'Receta eliminada correctamente',
        });
        refetch();
      } catch (error: unknown) {
        addNotification({
          type: 'error',
          title: 'Error',
          message: error instanceof Error ? error.message : 'Error al eliminar receta',
        });
      }
    }
  };

  const handleToggleStatus = async (recipe: Recipe) => {
    try {
      await updateRecipeMutation.mutateAsync({ id: recipe.id, isActive: !recipe.isActive });
      addNotification({
        type: 'success',
        title: 'Estado actualizado',
        message: `La receta "${recipe.name}" ha sido ${!recipe.isActive ? 'activada' : 'desactivada'}`,
      });
      refetch();
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al cambiar el estado de la receta',
      });
    }
  };

  const handleViewCost = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowCostModal(true);
  };

  // Genera la ficha técnica en PDF y la abre en pestaña nueva con el visor
  // nativo del navegador (zoom/imprimir/descargar sin UI propia).
  const handleViewSheet = async (recipe: Recipe) => {
    setGeneratingSheetId(recipe.id);
    try {
      const response = await apiClient.post(
        '/v1/technical-sheets/generate',
        { recipeId: recipe.id, includeAllergens: true, includeCosts: true },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      );
      window.open(url, '_blank', 'noopener');
      // El visor ya cargó el blob; liberar la URL pasado un margen amplio
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No se pudo generar la ficha técnica',
      });
    } finally {
      setGeneratingSheetId(null);
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { productId: '', productName: '', quantity: 0, unit: 'kg' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngredients = [...ingredients];
    if (field === 'productId') {
      const productId = String(value);
      const product = products.find((p) => p.id === productId);
      newIngredients[index] = {
        ...newIngredients[index],
        productId,
        productName: product?.name,
      };
      if (product?.allergens?.length) {
        setSelectedAllergenIds((prev) => Array.from(new Set([...prev, ...product.allergens])));
      }
    } else {
      newIngredients[index] = { ...newIngredients[index], [field]: value };
    }
    setIngredients(newIngredients);
  };

  const handleAddSubRecipe = () => {
    setSubRecipes([...subRecipes, { subRecipeId: '', quantity: 0, unit: 'raciones' }]);
  };

  const handleRemoveSubRecipe = (index: number) => {
    setSubRecipes(subRecipes.filter((_, i) => i !== index));
  };

  const handleSubRecipeChange = (index: number, field: keyof SubRecipeRow, value: string | number) => {
    const updated = [...subRecipes];
    updated[index] = { ...updated[index], [field]: value };
    setSubRecipes(updated);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const filledSteps = elaborationSteps.filter((s) => s.description.trim());
    const recipeData = {
      name: formData.name,
      description: formData.description || undefined,
      elaboration: filledSteps.length > 0 ? serializeSteps(filledSteps) : undefined,
      portions: parseInt(formData.portions, 10) || 1,
      portionSize: parseInt(formData.portionSize, 10) || 250,
      ingredients: ingredients.filter((ing) => ing.productId && ing.quantity > 0),
      subRecipes: subRecipes.filter((s) => s.subRecipeId && s.quantity > 0),
      categoryIds: selectedCategoryIds,
      allergens: selectedAllergenIds,
    };

    try {
      if (selectedRecipe) {
        await updateRecipeMutation.mutateAsync({ id: selectedRecipe.id, ...recipeData });
        addNotification({
          type: 'success',
          title: 'Receta actualizada',
          message: 'Receta actualizada correctamente',
        });
      } else {
        await createRecipeMutation.mutateAsync(recipeData);
        addNotification({
          type: 'success',
          title: 'Receta creada',
          message: 'Receta creada correctamente',
        });
      }
      setShowCreateForm(false);
      setSelectedRecipe(null);
      setFormData({
        name: '',
        description: '',
        portions: '1',
        portionSize: '250',
      });
      setElaborationSteps(parseSteps(null));
      setIngredients([{ productId: '', productName: '', quantity: 0, unit: 'kg' }]);
      setSubRecipes([]);
      setSelectedCategoryIds([]);
      setSelectedAllergenIds([]);
      refetch();
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al guardar receta',
      });
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setFormData({
      name: recipe.name,
      description: recipe.description || '',
      portions: recipe.portions.toString(),
      portionSize: recipe.portionSize?.toString() || '250',
    });
    setElaborationSteps(parseSteps(recipe.elaboration));
    setIngredients(recipe.ingredients);
    setSubRecipes(
      recipe.subRecipes?.map((s) => ({
        subRecipeId: s.subRecipeId,
        quantity: s.quantity,
        unit: s.unit,
      })) || [],
    );
    setSelectedCategoryIds(recipe.categories?.map(cat => cat.categoryId) || []);
    setSelectedAllergenIds(recipe.allergens || []);
    setShowCreateForm(true);
  };

  const filteredRecipes = recipes.filter((recipe: Recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recipe.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory ||
      recipe.categories?.some(cat => cat.categoryId === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  // Clave de ordenación por categoría: la primera alfabéticamente; sin categoría queda vacía
  const firstCategoryName = (recipe: Recipe): string =>
    recipe.categories
      ?.map((c) => c.categoryName)
      .sort((a, b) => a.localeCompare(b, 'es'))[0] ?? '';

  const costPerPortionOf = (recipe: Recipe): number =>
    recipe.costBreakdown?.costPerPortion ??
    (recipe.portions > 0 ? recipe.totalCost / recipe.portions : recipe.totalCost);

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name, 'es') * dir;
      case 'category': {
        const catA = firstCategoryName(a);
        const catB = firstCategoryName(b);
        // Las recetas sin categoría van siempre al final; empates se resuelven por nombre
        if (!catA && !catB) return a.name.localeCompare(b.name, 'es');
        if (!catA) return 1;
        if (!catB) return -1;
        return (catA.localeCompare(catB, 'es') || a.name.localeCompare(b.name, 'es')) * dir;
      }
      case 'totalCost':
        return (a.totalCost - b.totalCost) * dir;
      case 'costPerUnit':
        return (costPerPortionOf(a) - costPerPortionOf(b)) * dir;
    }
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortableHeader = (label: string, field: typeof sortField) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="group px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-150"
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
            )
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full">
      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Recetas</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Gestión de recetas y escandallos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoriesModal(true)}
              className="px-4 py-2 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Gestionar categorías
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Crear Receta
            </button>
          </div>
        </div>

        <CategoriesManagementModal
          isOpen={showCategoriesModal}
          onClose={() => setShowCategoriesModal(false)}
          context="recipes"
        />

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nombre o descripción"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!searchTerm && !selectedCategory}
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
              }}
              className="px-4 py-2 rounded-md border transition-all duration-200 flex items-center justify-center gap-2 h-[42px] mt-1 md:mt-0 font-medium text-sm select-none
                disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200
                dark:disabled:bg-zinc-800/40 dark:disabled:text-zinc-600 dark:disabled:border-zinc-800/50
                enabled:bg-white enabled:hover:bg-gray-50 enabled:text-gray-700 enabled:border-gray-300
                dark:enabled:bg-zinc-900 dark:enabled:hover:bg-zinc-800 dark:enabled:text-gray-300 dark:enabled:border-zinc-700
                enabled:cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Recipes Table */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-800/50">
                <tr>
                  {renderSortableHeader('Nombre', 'name')}
                  {renderSortableHeader('Categorías', 'category')}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Alérgenos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Porciones
                  </th>
                  {renderSortableHeader('Costo Total', 'totalCost')}
                  {renderSortableHeader('Costo/Ración', 'costPerUnit')}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {sortedRecipes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay recetas
                    </td>
                  </tr>
                ) : (
                  sortedRecipes.map((recipe: Recipe) => (
                    <tr key={recipe.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {recipe.name}
                        </div>
                        {recipe.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {recipe.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {recipe.categories && recipe.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {recipe.categories.map((cat) => (
                              <span
                                key={cat.categoryId}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                              >
                                {categories.find((c) => c.id === cat.categoryId)?.icon} {cat.categoryName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">Sin categorías</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {recipe.allergens && recipe.allergens.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {recipe.allergens.map((id) => (
                              <AllergenBadge key={id} id={id} allergen={allergenById.get(id)} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-600">Sin alérgenos</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {recipe.portions} ({recipe.portionSize}g)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatEuro(recipe.totalCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatEuro(costPerPortionOf(recipe))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(recipe)}
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
                            recipe.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {recipe.isActive ? 'Activo' : 'Desactivado'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleViewSheet(recipe)}
                          disabled={generatingSheetId === recipe.id}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-wait dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          {generatingSheetId === recipe.id ? 'Generando…' : 'Ficha'}
                        </button>
                        <button
                          onClick={() => handleViewCost(recipe)}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          Costo
                        </button>
                        <button
                          onClick={() => handleEdit(recipe)}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-[var(--secondary)]/30 dark:bg-[var(--secondary)]/10 dark:text-[var(--secondary)] dark:hover:bg-[var(--secondary)]/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id, recipe.name)}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-[var(--error)]/30 dark:bg-[var(--error)]/10 dark:text-[var(--error)] dark:hover:bg-[var(--error)]/20 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border w-full max-w-4xl shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-805">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl leading-6 font-semibold text-gray-900 dark:text-white">
                    {selectedRecipe ? 'Editar Receta' : 'Crear Receta'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedRecipe(null);
                      setFormData({
                        name: '',
                        description: '',
                        portions: '1',
                        portionSize: '250',
                      });
                      setElaborationSteps(parseSteps(null));
                      setIngredients([{ productId: '', productName: '', quantity: 0, unit: 'kg' }]);
                      setSubRecipes([]);
                    }}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Descripción
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                    />
                  </div>

                  {/* Pestañas para Categorías y Alérgenos */}
                  <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg mt-4 w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveMetaTab('categories')}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                        activeMetaTab === 'categories'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      Categorías
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMetaTab('allergens')}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                        activeMetaTab === 'allergens'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      Alérgenos
                    </button>
                  </div>

                  {/* Contenido de la Pestaña Activa */}
                  <div className="mt-2">
                    {activeMetaTab === 'categories' && (
                      <div className="flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-md border border-gray-100 dark:border-zinc-800">
                        {categories.map((category) => (
                          <label key={category.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(category.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                                } else {
                                  setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== category.id));
                                }
                              }}
                              className="rounded border-gray-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {category.icon} {category.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {activeMetaTab === 'allergens' && (
                      <div className="flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-md border border-gray-100 dark:border-zinc-800">
                        {allergenCatalog.map((allergen) => (
                          <label key={allergen.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAllergenIds.includes(allergen.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAllergenIds([...selectedAllergenIds, allergen.id]);
                                } else {
                                  setSelectedAllergenIds(selectedAllergenIds.filter(id => id !== allergen.id));
                                }
                              }}
                              className="rounded border-gray-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
                            />
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                              <AllergenIcon id={allergen.id} name={allergen.name} icon={allergen.icon} size={18} />
                              {allergen.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Porciones *
                      </label>
                      <input
                        type="number"
                        name="portions"
                        min="1"
                        required
                        value={formData.portions}
                        onChange={(e) =>
                          setFormData({ ...formData, portions: e.target.value })
                        }
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tamaño Porción (g)
                      </label>
                      <input
                        type="number"
                        name="portionSize"
                        min="1"
                        value={formData.portionSize}
                        onChange={(e) =>
                          setFormData({ ...formData, portionSize: e.target.value })
                        }
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <ElaborationStepEditor
                    steps={elaborationSteps}
                    onStepsChange={setElaborationSteps}
                  />

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ingredientes
                      </label>
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Agregar ingrediente
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                      {ingredients.map((ingredient, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <select
                            value={ingredient.productId}
                            onChange={(e) =>
                              handleIngredientChange(index, 'productId', e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">Seleccionar producto</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cantidad"
                            value={ingredient.quantity}
                            onChange={(e) =>
                              handleIngredientChange(index, 'quantity', parseFloat(e.target.value))
                            }
                            className="w-24 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <select
                            value={ingredient.unit}
                            onChange={(e) =>
                              handleIngredientChange(index, 'unit', e.target.value)
                            }
                            className="w-20 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="l">l</option>
                            <option value="ml">ml</option>
                            <option value="units">u</option>
                          </select>
                          {ingredients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(index)}
                              className="text-red-650 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold p-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sub-recetas */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sub-recetas
                      </label>
                      <button
                        type="button"
                        onClick={handleAddSubRecipe}
                        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Agregar sub-receta
                      </button>
                    </div>
                    {subRecipes.length > 0 && (
                      <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                        {subRecipes.map((sub, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <select
                              value={sub.subRecipeId}
                              onChange={(e) => handleSubRecipeChange(index, 'subRecipeId', e.target.value)}
                              className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Seleccionar receta</option>
                              {recipes
                                .filter((r) => r.id !== selectedRecipe?.id && r.isActive)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Cantidad"
                              value={sub.quantity}
                              onChange={(e) => handleSubRecipeChange(index, 'quantity', parseFloat(e.target.value))}
                              className="w-24 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <select
                              value={sub.unit}
                              onChange={(e) => handleSubRecipeChange(index, 'unit', e.target.value)}
                              className="w-28 px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="raciones">raciones</option>
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="l">l</option>
                              <option value="ml">ml</option>
                              <option value="units">u</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubRecipe(index)}
                              className="text-red-650 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold p-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setSelectedRecipe(null);
                        setFormData({
                          name: '',
                          description: '',
                          portions: '1',
                          portionSize: '250',
                        });
                        setElaborationSteps(parseSteps(null));
                        setIngredients([{ productId: '', productName: '', quantity: 0, unit: 'kg' }]);
                        setSubRecipes([]);
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={
                        createRecipeMutation.isPending ||
                        updateRecipeMutation.isPending
                      }
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {createRecipeMutation.isPending ||
                      updateRecipeMutation.isPending
                        ? 'Guardando...'
                        : selectedRecipe
                        ? 'Actualizar'
                        : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Cost Modal */}
        {showCostModal && selectedRecipe && (
          <RecipeCostModal
            recipe={selectedRecipe}
            onClose={() => {
              setShowCostModal(false);
              setSelectedRecipe(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

function RecipeCostModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { data: costData, isLoading: costLoading } = useRecipeCost(recipe.id);

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border border-gray-200 dark:border-zinc-800 w-full max-w-3xl shadow-xl rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Costo: {recipe.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {costLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Calculando costo...</div>
        ) : costData ? (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-4 rounded-lg transition-colors">
                <div className="text-sm text-green-700 dark:text-green-400">Costo Total</div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                  {formatEuro(costData.totalCost)}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg transition-colors">
                <div className="text-sm text-blue-700 dark:text-blue-400">Costo por Porción</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                  {formatEuro(costData.costPerPortion)}
                </div>
              </div>
            </div>

            <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Ingredientes</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                <thead className="bg-gray-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Unidad
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Costo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                  {costData.ingredients
                    ? costData.ingredients.map((ingredient, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {ingredient.productName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {ingredient.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {ingredient.unit}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                            {formatEuro(ingredient.cost)}
                          </td>
                        </tr>
                      ))
                    : recipe.ingredients.map((ingredient, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {ingredient.productName ?? ingredient.productId}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {ingredient.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {ingredient.unit}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                            —
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {recipe.subRecipes && recipe.subRecipes.length > 0 && (
              <>
                <h4 className="text-lg font-medium mt-6 mb-4 text-gray-900 dark:text-white">Sub-recetas</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Receta
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Cantidad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Unidad
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Costo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                      {recipe.subRecipes.map((sub, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {sub.subRecipeName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {sub.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {sub.unit}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                            {formatEuro(sub.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}