'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
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
  useDismissRecipeDuplicate,
  useUploadRecipeImage,
  RecipeIngredient,
} from '@/hooks/use-recipes';
import { processImageForUpload } from '@/lib/image-processing';

type SubRecipeRow = { subRecipeId: string; quantity: number; unit: string };
import ElaborationStepEditor, {
  ElaborationStep,
  parseSteps,
  serializeSteps,
} from './components/elaboration-step-editor';
import ProductCombobox from './components/product-combobox';
import SubRecipeCombobox from './components/sub-recipe-combobox';
import RecipeCostModal from './components/recipe-cost-modal';
import RecipeVisualView from './components/recipe-visual-view';
import { useInvalidateQueries } from '@/hooks/use-api';
import { ChevronUp, ChevronDown, RotateCcw, BookOpen, FileText, Calculator, Pencil, Trash2, Plus, ListChecks, Layers, Check, X, Eye, ImagePlus } from 'lucide-react';
import { useCategories, Category } from '@/hooks/use-categories';
import { useAllergens } from '@/hooks/use-allergens';
import { useRecipeNameCheck } from '@/hooks/use-recipe-name-check';
import AllergenBadge from '@/components/shared/allergen-badge';
import AllergenIcon from '@/components/shared/allergen-icon';
import apiClient from '@/lib/api-client';
import { formatEuro } from '@/lib/utils';
import { CategoriesManagementModal } from '@/components/shared/categories-management-modal';
import PaginationControls from '@/components/shared/pagination-controls';
import PageContainer from '@/components/shared/page-container';
import PageHeader from '@/components/shared/page-header';
import {
  tableCardClass, tableScrollClass, tableClass, theadClass, thBaseClass, thSortableClass, thActionsClass,
  tbodyClass, trHoverClass, tdBaseClass, tdActionsClass, actionButtonClass,
} from '@/components/shared/data-table-classes';

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
  const dismissDuplicateMutation = useDismissRecipeDuplicate();
  const uploadRecipeImageMutation = useUploadRecipeImage();
  const invalidateQueries = useInvalidateQueries();
  const recipeImageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingRecipeImage, setIsUploadingRecipeImage] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [visualViewRecipe, setVisualViewRecipe] = useState<Recipe | null>(null);
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

  // Vista móvil (< md): solo lectura, sin recetas desactivadas — el toggle
  // de estado y las demás acciones quedan reservadas a iPad/desktop.
  const mobileVisibleRecipes = useMemo(
    () => sortedRecipes.filter((recipe) => recipe.isActive !== false),
    [sortedRecipes],
  );

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portions: '1',
    portionSize: '250',
  });
  // Aviso advisory de duplicados por nombre (no bloquea). Al editar excluye la propia receta.
  const { matches: rawDuplicateRecipeNameMatches } = useRecipeNameCheck(formData.name, selectedRecipe?.id);
  // Descartes locales inmediatos: el backend ya no volverá a devolver estos
  // ids (persistido vía dismissDuplicateMutation), pero el hook de arriba no
  // refetchea solo al pulsar la X, así que se filtran aquí también.
  const [dismissedRecipeMatchIds, setDismissedRecipeMatchIds] = useState<Set<string>>(new Set());
  const duplicateRecipeNameMatches = rawDuplicateRecipeNameMatches.filter((m) => !dismissedRecipeMatchIds.has(m.id));

  const handleDismissRecipeDuplicate = (matchId: string) => {
    setDismissedRecipeMatchIds((prev) => new Set(prev).add(matchId));
    if (selectedRecipe?.id) {
      dismissDuplicateMutation.mutate({ recipeId: selectedRecipe.id, dismissedRecipeId: matchId });
    }
  };

  const [elaborationSteps, setElaborationSteps] = useState<ElaborationStep[]>(() => parseSteps(null));

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { productId: '', productName: '', quantity: 0, unit: 'kg' },
  ]);

  const [subRecipes, setSubRecipes] = useState<SubRecipeRow[]>([]);
  const [recipeImageUrl, setRecipeImageUrl] = useState('');

  // Peso total de los ingredientes en kg. Solo suma unidades de masa (kg/g);
  // l/ml y "unidades" no tienen un peso definido y se excluyen del total.
  const totalIngredientsWeightKg = useMemo(() => {
    return ingredients.reduce((total, ingredient) => {
      if (ingredient.unit === 'kg') return total + (ingredient.quantity || 0);
      if (ingredient.unit === 'g') return total + (ingredient.quantity || 0) / 1000;
      return total;
    }, 0);
  }, [ingredients]);

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
  // La pestaña se abre SÍNCRONAMENTE dentro del gesto del usuario: iOS Safari
  // bloquea window.open llamado tras un await (el gesto ya se consumió) y el
  // bloqueo es silencioso. Se abre vacía, muestra "Generando…" y navega al
  // blob cuando la respuesta llega.
  const openGeneratedPdf = async (
    recipe: Recipe,
    extraOptions: Record<string, unknown>,
    errorMessage: string,
  ) => {
    const win = window.open('', '_blank');
    if (!win) {
      addNotification({
        type: 'error',
        title: 'Ventana bloqueada',
        message: 'El navegador bloqueó la ventana emergente. Permite popups para este sitio e inténtalo de nuevo.',
      });
      return;
    }
    win.document.write(
      '<!doctype html><html><head><title>Generando PDF…</title></head>'
      + '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Generando PDF…</body></html>',
    );
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
      win.location.href = url;
      // El visor ya cargó el blob; liberar la URL pasado un margen amplio
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win.close();
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

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string | number | undefined) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  // Selección de ingrediente desde el combobox (búsqueda server-side). Recibe el
  // producto completo para resolver nombre y alérgenos sin el listado en cliente.
  const handleProductSelect = (
    index: number,
    product: { id: string; name: string; allergens?: number[]; wastePercentage?: number },
  ) => {
    const hasArticleWaste = (product.wastePercentage ?? 0) > 0;
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      productId: product.id,
      productName: product.name,
      hasArticleWaste,
      wastePercentage: product.wastePercentage,
      // Prefill con la merma del artículo (editable/sobreescribible después);
      // si el artículo no trae ninguna, se deja lo que hubiera escrito el usuario.
      wastePercentageOverride: hasArticleWaste
        ? product.wastePercentage
        : newIngredients[index].wastePercentageOverride,
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

  const handleRecipeImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    setIsUploadingRecipeImage(true);
    try {
      // 1600px: foto de plato a pantalla completa, no un avatar — necesita
      // más resolución que los 512px de processImageForUpload por defecto.
      const processed = await processImageForUpload(file, 1600);
      if (processed.size > 4 * 1024 * 1024) {
        addNotification({ type: 'error', title: 'Error', message: 'El archivo no puede superar los 4 MB' });
        return;
      }
      const form = new FormData();
      form.append('file', processed);
      const result = await uploadRecipeImageMutation.mutateAsync(form);
      setRecipeImageUrl(result.imageUrl);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al subir la foto',
      });
    } finally {
      setIsUploadingRecipeImage(false);
    }
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
      // '' + receta que ya tenía imagen = el usuario la quitó → null explícito
      // para que el backend la borre (undefined = "no tocar", ver update()).
      imageUrl: recipeImageUrl || (selectedRecipe?.imageUrl ? null : undefined),
      portions: parseInt(formData.portions, 10) || 1,
      portionSize: parseInt(formData.portionSize, 10) || 250,
      ingredients: ingredients
        .filter((ing) => ing.productId && ing.quantity > 0)
        .map((ing) => ({
          productId: ing.productId,
          productName: ing.productName,
          quantity: ing.quantity,
          unit: ing.unit,
          wastePercentageOverride: ing.wastePercentageOverride ?? undefined,
        })),
      subRecipes: subRecipes.filter((s) => s.subRecipeId && s.quantity > 0),
      categoryIds: selectedCategoryIds,
      allergens: selectedAllergenIds,
    };

    try {
      if (selectedRecipe) {
        await updateRecipeMutation.mutateAsync({ id: selectedRecipe.id, ...recipeData });
        invalidateQueries([['recipe-cost', selectedRecipe.id], ['recipe-options']]);
        addNotification({
          type: 'success',
          title: 'Receta actualizada',
          message: 'Receta actualizada correctamente',
        });
      } else {
        await createRecipeMutation.mutateAsync(recipeData);
        invalidateQueries([['recipe-options']]);
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
      setRecipeImageUrl('');
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
    setDismissedRecipeMatchIds(new Set());
    setFormData({
      name: recipe.name,
      description: recipe.description || '',
      portions: recipe.portions.toString(),
      portionSize: recipe.portionSize?.toString() || '250',
    });
    setElaborationSteps(parseSteps(recipe.elaboration));
    // El backend solo persiste wastePercentageOverride cuando se fijó
    // explícitamente; para que el campo muestre algo editable desde ya
    // (en vez de vacío) se prefilla con la merma efectiva ya calculada.
    setIngredients(
      recipe.ingredients.map((ing) => ({
        ...ing,
        wastePercentageOverride: ing.wastePercentageOverride ?? ing.wastePercentage,
      })),
    );
    setSubRecipes(
      recipe.subRecipes?.map((s) => ({
        subRecipeId: s.subRecipeId,
        quantity: s.quantity,
        unit: s.unit,
      })) || [],
    );
    setSelectedCategoryIds(recipe.categories?.map(cat => cat.categoryId) || []);
    setSelectedAllergenIds(recipe.allergens || []);
    setRecipeImageUrl(recipe.imageUrl || '');
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
        className={thSortableClass}
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

  const headerActions = (
    <>
      <button
        onClick={() => setShowCategoriesModal(true)}
        className="px-4 py-2 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        Gestionar categorías
      </button>
      <button
        onClick={() => { setActiveTab('general'); setDismissedRecipeMatchIds(new Set()); setShowCreateForm(true); }}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        Crear Receta
      </button>
    </>
  );

  return (
    <div className="w-full">
      <PageContainer>
        <PageHeader title="Recetas" subtitle="Gestión de recetas y escandallos" actions={headerActions} />

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
        <div className={tableCardClass}>
          {/* Vista móvil (< md): solo lectura — título, categoría e icono
              para ver/imprimir la receta. Sin ficha técnica, costo ni
              recetas desactivadas (eso queda para iPad/desktop). */}
          <div className="md:hidden divide-y divide-[var(--outline-variant)]">
            {mobileVisibleRecipes.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--on-surface-variant)]">
                No hay recetas
              </div>
            ) : (
              mobileVisibleRecipes.map((recipe: Recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setVisualViewRecipe(recipe)}
                  title="Ver receta"
                  aria-label={`Ver receta: ${recipe.name}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-container)] active:bg-[var(--surface-container-high)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--on-surface)] break-words">
                      {recipe.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {recipe.categories && recipe.categories.length > 0 ? (
                        recipe.categories.map((cat) => (
                          <span
                            key={cat.categoryId}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                          >
                            {categories.find((c) => c.id === cat.categoryId)?.icon} {cat.categoryName}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--outline)]">Sin categorías</span>
                      )}
                    </div>
                  </div>
                  <Eye className="h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
                </button>
              ))
            )}
          </div>

          {/* Vista tabla completa: iPad y desktop (>= md) */}
          <div className={`hidden md:block ${tableScrollClass}`}>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  {renderSortableHeader('Nombre', 'name')}
                  {renderSortableHeader('Categorías', 'category')}
                  <th className={thBaseClass}>Alérgenos</th>
                  <th className={thBaseClass}>Raciones</th>
                  {renderSortableHeader('Costo/Ración', 'costPerUnit')}
                  <th className={thBaseClass}>Estado</th>
                  <th className={thActionsClass}>Acciones</th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {sortedRecipes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-[var(--on-surface-variant)]">
                      No hay recetas
                    </td>
                  </tr>
                ) : (
                  sortedRecipes.map((recipe: Recipe) => {
                    const isOverTarget =
                      recipe.pricing?.costPercentage != null &&
                      recipe.pricing.costPercentage > recipe.pricing.targetCostPercentage;
                    return (
                    <tr key={recipe.id} className={trHoverClass}>
                      <td className="px-3 py-3 max-w-[210px]">
                        <div
                          className={`truncate text-sm font-medium ${
                            isOverTarget ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--on-surface)]'
                          }`}
                          title={
                            isOverTarget
                              ? `${recipe.name} — coste real ${recipe.pricing!.costPercentage!.toFixed(1)}% supera el objetivo ${recipe.pricing!.targetCostPercentage.toFixed(1)}%`
                              : recipe.name
                          }
                        >
                          {recipe.name}
                        </div>
                        {recipe.description && (
                          <div className="truncate text-sm text-[var(--on-surface-variant)]" title={recipe.description}>
                            {recipe.description}
                          </div>
                        )}
                      </td>
                      <td className={`${tdBaseClass} max-w-[160px]`}>
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
                          <span className="text-[var(--outline)]">Sin categorías</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {recipe.allergens && recipe.allergens.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {recipe.allergens.map((id) => (
                              <AllergenBadge key={id} id={id} allergen={allergenById.get(id)} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--outline)]">Sin alérgenos</span>
                        )}
                      </td>
                      <td className={tdBaseClass}>
                        {recipe.portions} ({recipe.portionSize}g)
                      </td>
                      <td className={tdBaseClass}>
                        {formatEuro(costPerPortionOf(recipe))}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {/* Icono en vez de texto: "Activo"/"Desactivado" era una de
                            las columnas que más ensanchaba la fila y ocultaba la
                            papelera en el viewport de iPad (mismo criterio que en
                            líneas de albarán). */}
                        <button
                          onClick={() => handleToggleStatus(recipe)}
                          title={recipe.isActive ? 'Activo — clic para desactivar' : 'Desactivado — clic para activar'}
                          aria-label={recipe.isActive ? 'Activo — clic para desactivar' : 'Desactivado — clic para activar'}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
                            recipe.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {recipe.isActive ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className={tdActionsClass}>
                        <button
                          onClick={() => setVisualViewRecipe(recipe)}
                          title="Vista visual"
                          aria-label="Vista visual"
                          className={`${actionButtonClass} border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-400 dark:hover:bg-sky-950/40`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewRecipeCard(recipe)}
                          disabled={generatingSheetId === recipe.id}
                          title="Receta (imprimir)"
                          aria-label="Receta (imprimir)"
                          className={`${actionButtonClass} border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-wait dark:border-purple-900/30 dark:bg-purple-950/20 dark:text-purple-400 dark:hover:bg-purple-950/40`}
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewSheet(recipe)}
                          disabled={generatingSheetId === recipe.id}
                          title="Ficha técnica"
                          aria-label="Ficha técnica"
                          className={`${actionButtonClass} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-wait dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/40`}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewCost(recipe)}
                          title="Costo"
                          aria-label="Costo"
                          className={`${actionButtonClass} border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40`}
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(recipe)}
                          title="Editar receta"
                          aria-label="Editar receta"
                          className={`${actionButtonClass} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-[var(--secondary)]/30 dark:bg-[var(--secondary)]/10 dark:text-[var(--secondary)] dark:hover:bg-[var(--secondary)]/20`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id, recipe.name)}
                          title="Eliminar receta"
                          aria-label="Eliminar receta"
                          className={`${actionButtonClass} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-[var(--error)]/30 dark:bg-[var(--error)]/10 dark:text-[var(--error)] dark:hover:bg-[var(--error)]/20`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })
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
                      setRecipeImageUrl('');
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
                              <div className="mt-2 flex flex-wrap gap-2">
                                {duplicateRecipeNameMatches.slice(0, 3).map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleDismissRecipeDuplicate(m.id)}
                                    title="No es la misma receta: descartar este aviso"
                                    aria-label={`No es la misma receta que «${m.name}»: descartar aviso`}
                                    className="inline-flex items-center gap-1 rounded border border-amber-400 px-1.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/60 transition-colors"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    No es duplicado de «{m.name}»
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={m3Label}>Foto</label>
                        <input
                          ref={recipeImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          onChange={handleRecipeImageFileChange}
                          className="hidden"
                        />
                        <div className="mt-1 flex items-center gap-3">
                          {recipeImageUrl ? (
                            <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
                              <Image src={recipeImageUrl} alt="" fill sizes="112px" className="object-cover" />
                              <button
                                type="button"
                                onClick={() => setRecipeImageUrl('')}
                                title="Quitar foto"
                                aria-label="Quitar foto"
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--outline)]">
                              <ImagePlus className="h-6 w-6" />
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={isUploadingRecipeImage}
                            onClick={() => recipeImageInputRef.current?.click()}
                            className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--on-surface)]/5 disabled:opacity-50 disabled:cursor-wait transition-colors"
                          >
                            {isUploadingRecipeImage ? 'Subiendo…' : recipeImageUrl ? 'Cambiar foto' : 'Subir foto'}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={m3Label}>Notas</label>
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
                          <label className={m3Label}>Raciones *</label>
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
                          <label className={m3Label}>Peso Ración (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            name="portionSize"
                            value={formData.portionSize}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                              setFormData({ ...formData, portionSize: sanitized });
                            }}
                            className={m3Field}
                          />
                        </div>
                      </div>

                      {/* Ingredientes */}
                      <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-1.5">
                            <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-[var(--on-surface)]">
                              Ingredientes
                              {ingredients.length > 0 && (
                                <span className="ml-1 font-normal text-[var(--on-surface-variant)]">({ingredients.length})</span>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddIngredient}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
                          >
                            <Plus className="h-4 w-4" />
                            Agregar ingrediente
                          </button>
                        </div>
                        {totalIngredientsWeightKg > 0 && (
                          <p className="text-xs text-[var(--muted-foreground)] mb-2">
                            Peso total: {totalIngredientsWeightKg.toFixed(3)} kg
                          </p>
                        )}
                        {/* Cabecera fija dentro del propio scroll: con muchas líneas, las
                            columnas nunca se pierden de vista al bajar. max-h relativo al
                            viewport (no un px fijo) para aprovechar pantallas grandes. */}
                        <div className="rounded-lg border border-[var(--outline-variant)] overflow-hidden">
                          <div className="max-h-[48vh] overflow-y-auto bg-[var(--surface-container-lowest)]">
                            <div className="sticky top-0 z-10 grid grid-cols-[1fr_5.5rem_4.5rem_5rem_1.75rem] gap-x-2 border-b border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-2 py-1.5 text-xs font-medium text-[var(--on-surface-variant)]">
                              <span>Artículo</span>
                              <span>Cantidad</span>
                              <span>Unidad</span>
                              <span>Merma %</span>
                              <span />
                            </div>
                            <div className="divide-y divide-[var(--outline-variant)]/60">
                              {ingredients.map((ingredient, index) => (
                                <div
                                  key={index}
                                  className={`grid grid-cols-[1fr_5.5rem_4.5rem_5rem_1.75rem] gap-x-2 items-center px-2 py-1.5 transition-colors hover:bg-[var(--primary)]/5 ${
                                    index % 2 === 1 ? 'bg-[var(--surface-container)]/50' : ''
                                  }`}
                                >
                                  <ProductCombobox
                                    value={ingredient.productId}
                                    label={ingredient.productName}
                                    onSelect={(product) => handleProductSelect(index, product)}
                                  />
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    placeholder="Cant."
                                    value={ingredient.quantity}
                                    onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value))}
                                    className={`w-full text-sm ${m3InputBase}`}
                                  />
                                  <select
                                    value={ingredient.unit}
                                    onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                                    className={`w-full text-sm ${m3InputBase}`}
                                  >
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                    <option value="ml">ml</option>
                                    <option value="units">u</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    title={
                                      ingredient.hasArticleWaste
                                        ? 'Merma % del artículo — puedes sobreescribirla solo para esta receta'
                                        : 'Merma % manual de esta receta (el artículo no tiene una definida)'
                                    }
                                    placeholder="Merma %"
                                    value={ingredient.wastePercentageOverride ?? ''}
                                    onChange={(e) =>
                                      handleIngredientChange(
                                        index,
                                        'wastePercentageOverride',
                                        e.target.value === '' ? undefined : parseFloat(e.target.value),
                                      )
                                    }
                                    className={`w-full text-sm ${m3InputBase}`}
                                  />
                                  {ingredients.length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIngredient(index)}
                                      title="Quitar ingrediente"
                                      className="justify-self-center rounded-lg p-1 font-bold text-[var(--error)] hover:bg-[var(--error)]/10"
                                    >
                                      ✕
                                    </button>
                                  ) : (
                                    <span />
                                  )}
                                </div>
                              ))}
                            </div>
                            {/* Añadir al final de la lista: con muchos ingredientes evita
                                volver a subir hasta el botón de arriba. */}
                            <button
                              type="button"
                              onClick={handleAddIngredient}
                              className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--outline-variant)] px-2 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                            >
                              <Plus className="h-4 w-4" />
                              Agregar ingrediente
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sub-recetas */}
                      <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-[var(--on-surface)]">Sub-recetas</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSubRecipe}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
                          >
                            <Plus className="h-4 w-4" />
                            Agregar sub-receta
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
                        setRecipeImageUrl('');
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

        {/* Vista visual (imagen, ingredientes, pasos) */}
        {visualViewRecipe && (
          <RecipeVisualView
            recipe={visualViewRecipe}
            allergenById={allergenById}
            isPrinting={generatingSheetId === visualViewRecipe.id}
            onPrint={() => handleViewRecipeCard(visualViewRecipe)}
            onClose={() => setVisualViewRecipe(null)}
          />
        )}
      </PageContainer>
    </div>
  );
}