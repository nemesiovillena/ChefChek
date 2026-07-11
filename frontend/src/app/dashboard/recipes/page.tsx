'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  useRecipes,
  useRecipeOptions,
  Recipe,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  RecipeIngredient,
} from '@/hooks/use-recipes';

type SubRecipeRow = { subRecipeId: string; quantity: number; unit: string };
import ElaborationStepEditor, {
  ElaborationStep,
  parseSteps,
  serializeSteps,
} from './components/elaboration-step-editor';
import ProductCombobox from './components/product-combobox';
import SubRecipeCombobox from './components/sub-recipe-combobox';
import RecipeCostModal from './components/recipe-cost-modal';
import { ChevronUp, ChevronDown, RotateCcw, BookOpen, FileText, Calculator, Pencil, Trash2 } from 'lucide-react';
import { useCategories, Category } from '@/hooks/use-categories';
import { useAllergens } from '@/hooks/use-allergens';
import { useRecipeNameCheck } from '@/hooks/use-recipe-name-check';
import AllergenBadge from '@/components/shared/allergen-badge';
import AllergenIcon from '@/components/shared/allergen-icon';
import apiClient from '@/lib/api-client';
import { formatEuro } from '@/lib/utils';
import { CategoriesManagementModal } from '@/components/shared/categories-management-modal';
import PaginationControls from '@/components/shared/pagination-controls';

export const dynamic = 'force-dynamic';

// Estilos Material 3 compartidos del modal de receta. Los tokens viven en
// globals.css y .dark los redefine, por eso no hace falta variante dark:.
const m3InputBase =
  'px-3 py-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 transition-colors';
const m3Field = `mt-1 block w-full text-sm placeholder:text-[var(--on-surface-variant)] ${m3InputBase}`;
const m3Label = 'block text-sm font-medium text-[var(--on-surface)]';
const RECIPE_TABS = [
  { id: 'general', label: 'General' },
  { id: 'elaboracion', label: 'Elaboración' },
  { id: 'clasificacion', label: 'Clasificación' },
] as const;

export default function RecipesPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();

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
  const [activeTab, setActiveTab] = useState<'general' | 'elaboracion' | 'clasificacion'>('general');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortField, setSortField] = useState<'name' | 'category' | 'costPerUnit'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<number[]>([]);
  const [generatingSheetId, setGeneratingSheetId] = useState<string | null>(null);

  // Paginación server-side
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  // "category"/"costPerUnit" son calculados en cliente (primera categoría
  // alfabética, coste en vivo) — el backend solo ordena por columnas reales
  // (name/createdAt). Para esos dos, se pide la página en orden base por
  // nombre y se reordena en cliente SOLO dentro de la página visible.
  const { data: recipesData, error: recipesError, refetch } = useRecipes({
    search: debouncedSearch || undefined,
    category: selectedCategory || undefined,
    sortBy: 'name',
    sortOrder: sortField === 'name' ? sortDirection : 'asc',
    page,
    pageSize,
  });
  const recipes: Recipe[] = useMemo(() => recipesData?.data ?? [], [recipesData]);
  const totalItems = recipesData?.total ?? 0;
  const totalPages = recipesData?.totalPages ?? 1;

  // Picker de sub-recetas: necesita TODAS las recetas activas, no solo la
  // página visible del listado principal (ya paginado).
  const { data: recipeOptions } = useRecipeOptions();
  const allActiveRecipeOptions = recipeOptions ?? [];

  // Clave de ordenación por categoría: la primera alfabéticamente; sin categoría queda vacía
  const firstCategoryName = (recipe: Recipe): string =>
    recipe.categories
      ?.map((c) => c.categoryName)
      .sort((a, b) => a.localeCompare(b, 'es'))[0] ?? '';

  const costPerPortionOf = (recipe: Recipe): number =>
    recipe.costBreakdown?.costPerPortion ??
    (recipe.portions > 0 ? recipe.totalCost / recipe.portions : recipe.totalCost);

  // "name" ya viene ordenado del servidor (todo el dataset). "category" y
  // "costPerUnit" son calculados, así que solo reordenan la página visible
  // — limitación conocida y aceptada (ver plan de paginación de recetas).
  const sortedRecipes = useMemo(() => {
    if (sortField === 'name') return recipes;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...recipes].sort((a, b) => {
      if (sortField === 'category') {
        const catA = firstCategoryName(a);
        const catB = firstCategoryName(b);
        // Las recetas sin categoría van siempre al final; empates se resuelven por nombre
        if (!catA && !catB) return a.name.localeCompare(b.name, 'es');
        if (!catA) return 1;
        if (!catB) return -1;
        return (catA.localeCompare(catB, 'es') || a.name.localeCompare(b.name, 'es')) * dir;
      }
      return (costPerPortionOf(a) - costPerPortionOf(b)) * dir;
    });
  }, [recipes, sortField, sortDirection]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portions: '1',
    portionSize: '250',
  });
  // Aviso advisory de duplicados por nombre (no bloquea). Al editar excluye la propia receta.
  const { matches: duplicateRecipeNameMatches } = useRecipeNameCheck(formData.name, selectedRecipe?.id);

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
    const ok = await confirm({
      title: 'Eliminar receta',
      description: `¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteRecipeMutation.mutateAsync(id);
      addNotification({
        type: 'success',
        title: 'Receta eliminada',
        message: `"${name}" se ha eliminado correctamente.`,
      });
      refetch();
    } catch (error: unknown) {
      addNotification({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'Error al eliminar receta',
      });
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

  // Genera un PDF de /v1/technical-sheets/generate y lo abre en pestaña nueva
  // con el visor nativo del navegador (zoom/imprimir/descargar sin UI propia).
  const openGeneratedPdf = async (
    recipe: Recipe,
    extraOptions: Record<string, unknown>,
    errorMessage: string,
  ) => {
    setGeneratingSheetId(recipe.id);
    try {
      const response = await apiClient.post(
        '/v1/technical-sheets/generate',
        { recipeId: recipe.id, ...extraOptions },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      );
      window.open(url, '_blank', 'noopener');
      // El visor ya cargó el blob; liberar la URL pasado un margen amplio
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: errorMessage });
    } finally {
      setGeneratingSheetId(null);
    }
  };

  const handleViewSheet = (recipe: Recipe) =>
    openGeneratedPdf(
      recipe,
      { includeAllergens: true, includeCosts: true },
      'No se pudo generar la ficha técnica',
    );

  // "Receta" imprimible: solo nombre+descripción, ingredientes y elaboración
  // (utensilios/tiempo/temperatura) — sin costes ni alérgenos.
  const handleViewRecipeCard = (recipe: Recipe) =>
    openGeneratedPdf(
      recipe,
      { recipeCardOnly: true },
      'No se pudo generar la receta',
    );

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { productId: '', productName: '', quantity: 0, unit: 'kg' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  // Selección de ingrediente desde el combobox (búsqueda server-side). Recibe el
  // producto completo para resolver nombre y alérgenos sin el listado en cliente.
  const handleProductSelect = (
    index: number,
    product: { id: string; name: string; allergens?: number[] },
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      productId: product.id,
      productName: product.name,
    };
    setIngredients(newIngredients);
    if (product.allergens?.length) {
      setSelectedAllergenIds((prev) => Array.from(new Set([...prev, ...product.allergens!])));
    }
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

    // El nombre es requerido: si se envía desde otra pestaña, volvemos a General
    // para que el navegador dispare la validación nativa del campo.
    if (!formData.name.trim()) {
      setActiveTab('general');
      return;
    }

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
    setActiveTab('general');
    setShowCreateForm(true);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
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
              onClick={() => { setActiveTab('general'); setShowCreateForm(true); }}
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
                onChange={(e) => handleSearchChange(e.target.value)}
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
                onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
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
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                setSearchTerm('');
                setDebouncedSearch('');
                setSelectedCategory('');
                setPage(1);
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

        <div className="mb-6">
          <PaginationControls
            variant="card"
            page={page}
            totalPages={totalPages}
            total={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            emptyLabel="Sin recetas"
          />
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
                    Raciones
                  </th>
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
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
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
                          onClick={() => handleViewRecipeCard(recipe)}
                          disabled={generatingSheetId === recipe.id}
                          title="Receta (imprimir)"
                          aria-label="Receta (imprimir)"
                          className="inline-flex items-center justify-center p-2 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-wait dark:border-purple-900/30 dark:bg-purple-950/20 dark:text-purple-400 dark:hover:bg-purple-950/40 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewSheet(recipe)}
                          disabled={generatingSheetId === recipe.id}
                          title="Ficha técnica"
                          aria-label="Ficha técnica"
                          className="inline-flex items-center justify-center p-2 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-wait dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewCost(recipe)}
                          title="Costo"
                          aria-label="Costo"
                          className="inline-flex items-center justify-center p-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(recipe)}
                          title="Editar receta"
                          aria-label="Editar receta"
                          className="inline-flex items-center justify-center p-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-[var(--secondary)]/30 dark:bg-[var(--secondary)]/10 dark:text-[var(--secondary)] dark:hover:bg-[var(--secondary)]/20 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id, recipe.name)}
                          title="Eliminar receta"
                          aria-label="Eliminar receta"
                          className="inline-flex items-center justify-center p-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-[var(--error)]/30 dark:bg-[var(--error)]/10 dark:text-[var(--error)] dark:hover:bg-[var(--error)]/20 rounded-md transition-all duration-200 active:scale-[0.97] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            emptyLabel="Sin recetas"
          />
        </div>

        {/* Create/Edit Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] overflow-y-auto h-full w-full z-50 flex items-start justify-center p-4">
            <div className="relative top-8 mx-auto w-full max-w-3xl mb-8 rounded-[28px] border border-[var(--outline-variant)] bg-[var(--surface-container-high)] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18)]">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--on-surface)]">
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
                    className="rounded-full p-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--on-surface)]/10 transition-colors"
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

                {/* Pestañas de sección. Se usa role="tablist" (no <nav>) porque
                    globals.css oculta todo <nav> que no sea .fixed. */}
                <div role="tablist" aria-label="Secciones de la receta" className="flex gap-1 border-b border-[var(--outline-variant)]">
                  {RECIPE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === tab.id
                          ? 'border-[var(--primary)] text-[var(--primary)]'
                          : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  {/* ── General: identidad + composición (define la receta y su coste) ── */}
                  {activeTab === 'general' && (
                    <div className="space-y-4">
                      <div>
                        <label className={m3Label}>Nombre *</label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={m3Field}
                        />
                        {duplicateRecipeNameMatches.length > 0 && (
                          <div role="status" className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            <div>
                              <span className="font-medium">Posible duplicado.</span> Ya existe una receta con nombre similar:{' '}
                              {duplicateRecipeNameMatches.slice(0, 3).map((m, idx) => (
                                <span key={m.id}>
                                  <span className="font-semibold">«{m.name}»</span>
                                  {!m.isActive && <span className="font-normal italic"> (inactivo)</span>}
                                  {idx < Math.min(duplicateRecipeNameMatches.length, 3) - 1 ? ', ' : ''}
                                </span>
                              ))}
                              {duplicateRecipeNameMatches.length > 3 ? ` y ${duplicateRecipeNameMatches.length - 3} más.` : '.'}{' '}
                              Puedes continuar si es una receta distinta.
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={m3Label}>Descripción</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          className={m3Field}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={m3Label}>Porciones *</label>
                          <input
                            type="number"
                            name="portions"
                            min="1"
                            required
                            value={formData.portions}
                            onChange={(e) => setFormData({ ...formData, portions: e.target.value })}
                            className={m3Field}
                          />
                        </div>
                        <div>
                          <label className={m3Label}>Tamaño Porción (g)</label>
                          <input
                            type="number"
                            name="portionSize"
                            min="1"
                            value={formData.portionSize}
                            onChange={(e) => setFormData({ ...formData, portionSize: e.target.value })}
                            className={m3Field}
                          />
                        </div>
                      </div>

                      {/* Ingredientes */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className={m3Label}>Ingredientes</label>
                          <button
                            type="button"
                            onClick={handleAddIngredient}
                            className="text-sm font-medium text-[var(--primary)] hover:brightness-110"
                          >
                            + Agregar ingrediente
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                          {ingredients.map((ingredient, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <ProductCombobox
                                value={ingredient.productId}
                                label={ingredient.productName}
                                onSelect={(product) => handleProductSelect(index, product)}
                              />
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="Cantidad"
                                value={ingredient.quantity}
                                onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value))}
                                className={`w-24 text-sm ${m3InputBase}`}
                              />
                              <select
                                value={ingredient.unit}
                                onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                                className={`w-20 text-sm ${m3InputBase}`}
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
                                  className="rounded-lg p-1 font-bold text-[var(--error)] hover:bg-[var(--error)]/10"
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
                          <label className={m3Label}>Sub-recetas</label>
                          <button
                            type="button"
                            onClick={handleAddSubRecipe}
                            className="text-sm font-medium text-[var(--primary)] hover:brightness-110"
                          >
                            + Agregar sub-receta
                          </button>
                        </div>
                        {subRecipes.length > 0 && (
                          <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                            {subRecipes.map((sub, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <SubRecipeCombobox
                                  items={allActiveRecipeOptions.filter((r) => r.id !== selectedRecipe?.id)}
                                  value={sub.subRecipeId}
                                  label={allActiveRecipeOptions.find((r) => r.id === sub.subRecipeId)?.name}
                                  onSelect={(item) => handleSubRecipeChange(index, 'subRecipeId', item.id)}
                                />
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="Cantidad"
                                  value={sub.quantity}
                                  onChange={(e) => handleSubRecipeChange(index, 'quantity', parseFloat(e.target.value))}
                                  className={`w-24 text-sm ${m3InputBase}`}
                                />
                                <select
                                  value={sub.unit}
                                  onChange={(e) => handleSubRecipeChange(index, 'unit', e.target.value)}
                                  className={`w-28 text-sm ${m3InputBase}`}
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
                                  className="rounded-lg p-1 font-bold text-[var(--error)] hover:bg-[var(--error)]/10"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Elaboración: pasos de la receta ── */}
                  {activeTab === 'elaboracion' && (
                    <ElaborationStepEditor steps={elaborationSteps} onStepsChange={setElaborationSteps} />
                  )}

                  {/* ── Clasificación: categorías y alérgenos (metadatos, no afectan al coste) ── */}
                  {activeTab === 'clasificacion' && (
                    <div className="space-y-4">
                      <div>
                        <label className={`${m3Label} mb-2`}>Categorías</label>
                        <div className="flex flex-wrap gap-4 p-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
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
                                className="rounded border-[var(--outline-variant)] text-[var(--primary)] focus:ring-[var(--primary)]/40 bg-[var(--surface-container-lowest)]"
                              />
                              <span className="text-sm text-[var(--on-surface)]">
                                {category.icon} {category.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={`${m3Label} mb-2`}>Alérgenos</label>
                        <div className="flex flex-wrap gap-4 p-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
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
                                className="rounded border-[var(--outline-variant)] text-[var(--primary)] focus:ring-[var(--primary)]/40 bg-[var(--surface-container-lowest)]"
                              />
                              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--on-surface)]">
                                <AllergenIcon id={allergen.id} name={allergen.name} icon={allergen.icon} size={18} />
                                {allergen.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t border-[var(--outline-variant)]">
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
                      className="rounded-full px-5 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--on-surface)]/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={
                        createRecipeMutation.isPending ||
                        updateRecipeMutation.isPending
                      }
                      className="rounded-full px-5 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition"
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