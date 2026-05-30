'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNotification } from '@/components/notification-system';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import ListItem from '@tiptap/extension-list-item';

interface Ingredient {
  productId: string;
  productName?: string;
  quantity: number;
  unit: string;
}

interface SubRecipe {
  subRecipeId: string;
  subRecipeName?: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  elaboration: string;
  portions: number;
  portionSize: number;
  totalCost: number;
  totalCostPerUnit: number;
  version: number;
  parentVersion?: string;
  isActive: boolean;
  isPublic: boolean;
  ingredients?: Ingredient[];
  subRecipes?: SubRecipe[];
  costBreakdown?: {
    ingredientsCost: number;
    subRecipesCost: number;
    totalCost: number;
    costPerPortion: number;
    costPerUnit: number;
  };
  allergens?: number[];
}

export default function RecipesPage() {
  const t = useTranslations('nav');
  const addNotification = useNotification();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [session, setSession] = useState<any>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');

  // Datos adicionales
  const [products, setProducts] = useState<any[]>([]);
  const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portions: 1,
    portionSize: 1,
    isPublic: false,
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);

  // TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ListItem,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-xl mx-auto focus:outline-none',
      },
    },
  });

  useEffect(() => {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      setSession(parsedSession.session);
      fetchRecipes(parsedSession.session.token);
      fetchProducts(parsedSession.session.token);
      fetchAvailableRecipes(parsedSession.session.token);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchRecipes = async (token: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);

      const response = await fetch(`http://localhost:3001/api/v1/recipes?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setRecipes(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch recipes',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchAvailableRecipes = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/recipes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setAvailableRecipes(data.data);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editor) return;

    const recipeData = {
      name: formData.name,
      description: formData.description,
      elaboration: JSON.stringify(editor.getJSON()),
      portions: parseInt(formData.portions.toString()),
      portionSize: parseFloat(formData.portionSize.toString()),
      ingredients: ingredients,
      subRecipes: subRecipes,
      isPublic: formData.isPublic,
    };

    try {
      const response = await fetch('http://localhost:3001/api/v1/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
        body: JSON.stringify(recipeData),
      });

      const data = await response.json();
      if (data.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Recipe created successfully',
        });
        setShowCreateForm(false);
        fetchRecipes(session?.token);
        resetForm();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create recipe',
      });
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, {
      productId: '',
      quantity: 0,
      unit: 'Gramos',
    }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleUpdateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill product name when product is selected
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index] = { ...updated[index], productName: product.name, unit: product.recipeUnit };
      }
    }

    setIngredients(updated);
  };

  const handleAddSubRecipe = () => {
    setSubRecipes([...subRecipes, {
      subRecipeId: '',
      quantity: 0,
      unit: 'Gramos',
    }]);
  };

  const handleRemoveSubRecipe = (index: number) => {
    setSubRecipes(subRecipes.filter((_, i) => i !== index));
  };

  const handleUpdateSubRecipe = (index: number, field: keyof SubRecipe, value: any) => {
    const updated = [...subRecipes];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill sub-recipe name when selected
    if (field === 'subRecipeId') {
      const recipe = availableRecipes.find(r => r.id === value);
      if (recipe) {
        updated[index] = { ...updated[index], subRecipeName: recipe.name };
      }
    }

    setSubRecipes(updated);
  };

  const handleViewDetails = async (recipeId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/recipes/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setSelectedRecipe(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch recipe details',
      });
    }
  };

  const handleDuplicate = async (recipeId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/recipes/${recipeId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Recipe duplicated successfully',
        });
        fetchRecipes(session?.token);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to duplicate recipe',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      portions: 1,
      portionSize: 1,
      isPublic: false,
    });
    setIngredients([]);
    setSubRecipes([]);
    editor?.commands.setContent('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : 'Create Recipe'}
          </button>
        </div>

        {/* Filtro de búsqueda */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchRecipes(session?.token)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search recipes..."
            />
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => fetchRecipes(session?.token)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                fetchRecipes(session?.token);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Formulario de Creación */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Recipe</h2>
            <form onSubmit={handleCreateRecipe} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portions *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.portions}
                    onChange={(e) => setFormData({ ...formData, portions: parseInt(e.target.value) })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portion Size</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.portionSize}
                    onChange={(e) => setFormData({ ...formData, portionSize: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* TipTap Editor */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Elaboration Instructions</h3>
                <div className="border border-gray-300 rounded-md">
                  <div className="bg-gray-50 px-4 py-2 border-b flex space-x-2">
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`px-3 py-1 rounded ${editor?.isActive('bold') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`px-3 py-1 rounded ${editor?.isActive('italic') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={`px-3 py-1 rounded ${editor?.isActive('underline') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Underline
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      className={`px-3 py-1 rounded ${editor?.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Bullet List
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      className={`px-3 py-1 rounded ${editor?.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                    >
                      Numbered List
                    </button>
                  </div>
                  <EditorContent editor={editor} className="prose max-w-none p-4" />
                </div>
              </div>

              {/* Ingredientes Base */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Base Ingredients</h3>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    + Add Ingredient
                  </button>
                </div>
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <select
                      value={ingredient.productId}
                      onChange={(e) => handleUpdateIngredient(index, 'productId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Product</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.recipeUnit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={ingredient.quantity}
                      onChange={(e) => handleUpdateIngredient(index, 'quantity', parseFloat(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => handleUpdateIngredient(index, 'unit', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Unit"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Sub-Recetas */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Sub-Recipes</h3>
                  <button
                    type="button"
                    onClick={handleAddSubRecipe}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    + Add Sub-Recipe
                  </button>
                </div>
                {subRecipes.map((subRecipe, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <select
                      value={subRecipe.subRecipeId}
                      onChange={(e) => handleUpdateSubRecipe(index, 'subRecipeId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Recipe</option>
                      {availableRecipes.map(recipe => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={subRecipe.quantity}
                      onChange={(e) => handleUpdateSubRecipe(index, 'quantity', parseFloat(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      value={subRecipe.unit}
                      onChange={(e) => handleUpdateSubRecipe(index, 'unit', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Unit"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSubRecipe(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Opciones adicionales */}
              <div className="border-t pt-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Public Recipe</span>
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Recipe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Recetas */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Portions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost/Portion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No recipes found
                  </td>
                </tr>
              ) : (
                recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{recipe.name}</div>
                        {recipe.description && (
                          <div className="text-sm text-gray-500">{recipe.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {recipe.portions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      €{recipe.totalCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      €{recipe.costBreakdown?.costPerPortion.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      v{recipe.version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        recipe.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {recipe.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {recipe.isPublic && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Public
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetails(recipe.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDuplicate(recipe.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}