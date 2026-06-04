'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-system';

export const dynamic = 'force-dynamic';

interface Recipe {
  id: string;
  name: string;
  category: string;
  description?: string;
  portions: number;
  isActive: boolean;
  createdAt: string;
}

export default function RecipesPage() {
  const { user, session, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    portions: '1',
  });

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  useEffect(() => {
    if (session?.id) {
      fetchRecipes();
    }
  }, [session]);

  const fetchRecipes = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/recipes', {
        headers: {
          'Authorization': `Bearer ${session?.id}`,
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
      setPageLoading(false);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const recipeData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      portions: parseInt(formData.get('portions') as string, 10) || 1,
    };

    try {
      const response = await fetch('http://localhost:3001/api/v1/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.id}`,
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
        fetchRecipes();
        e.currentTarget.reset();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create recipe',
      });
    }
  };

  const handleViewDetails = async (recipeId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/recipes/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${session?.id}`,
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

  if (loading || pageLoading) {
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

        {/* Formulario de Creación */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Recipe</h2>
            <form onSubmit={handleCreateRecipe} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <input
                  name="category"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portions *
                </label>
                <input
                  name="portions"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  onClick={() => setShowCreateForm(false)}
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
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Portions
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
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
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
                      {recipe.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {recipe.portions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        recipe.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {recipe.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewDetails(recipe.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de Detalles */}
        {selectedRecipe && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <h3 className="text-2xl font-bold mb-4">{selectedRecipe.name}</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600">Category:</span>
                  <span className="ml-2 font-medium">{selectedRecipe.category}</span>
                </div>
                <div>
                  <span className="text-gray-600">Portions:</span>
                  <span className="ml-2 font-medium">{selectedRecipe.portions}</span>
                </div>
                {selectedRecipe.description && (
                  <div>
                    <span className="text-gray-600">Description:</span>
                    <p className="mt-1">{selectedRecipe.description}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2">
                    {new Date(selectedRecipe.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}