'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { ALLERGENS_INFO } from '@/types/allergens';

interface Product {
  id: string;
  name: string;
  allergens: number[];
}

interface Recipe {
  id: string;
  name: string;
  allergens: number[];
}

interface Menu {
  id: string;
  name: string;
  allergens: number[];
}

interface AllergenConflict {
  recipeId: string;
  filteredAllergens: number[];
}

interface ComplianceReport {
  menuId: string;
  reportType: 'FULL' | 'SUMMARY';
  missingDeclarations?: number[];
  conflicts?: AllergenConflict[];
}

export const dynamic = 'force-dynamic';

export default function AllergensManagementPage() {
  const router = useRouter();
  const { session, isAuthenticated, loading: authLoading } = useAuth();

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent loading if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<number[]>([]);
  const [conflicts, setConflicts] = useState<AllergenConflict[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'recipes' | 'menus' | 'conflicts' | 'compliance'>('products');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, recipesRes, menusRes] = await Promise.all([
        fetch('/api/v1/allergens/products'),
        fetch('/api/v1/allergens/recipes'),
        fetch('/api/v1/allergens/menus'),
      ]);

      const productsData = await productsRes.json();
      const recipesData = await recipesRes.json();
      const menusData = await menusRes.json();

      setProducts(productsData.data || []);
      setRecipes(recipesData.data || []);
      setMenus(menusData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAllergen = (allergenId: number) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergenId) ? prev.filter((id) => id !== allergenId) : [...prev, allergenId]
    );
  };

  const handleUpdateProductAllergens = async (productId: string, allergens: number[]) => {
    try {
      const response = await fetch(`/api/v1/allergens/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergens }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error updating product allergens:', error);
    }
  };

  const handleCalculateRecipeAllergens = async (recipeId: string) => {
    try {
      const response = await fetch(`/api/v1/allergens/recipes/${recipeId}/calculate`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error calculating recipe allergens:', error);
    }
  };

  const handleCalculateMenuAllergens = async (menuId: string) => {
    try {
      const response = await fetch(`/api/v1/allergens/menus/${menuId}/calculate`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error calculating menu allergens:', error);
    }
  };

  const handleDetectConflicts = async (menuId: string) => {
    if (selectedAllergens.length === 0) {
      alert('Selecciona al menos un alérgeno para filtrar');
      return;
    }

    try {
      const response = await fetch(`/api/v1/allergens/menus/${menuId}/conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filteredAllergens: selectedAllergens }),
      });

      if (response.ok) {
        const data = await response.json();
        setConflicts(data.data.conflicts || []);
        setActiveTab('conflicts');
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error);
    }
  };

  const handleGenerateComplianceReport = async (menuId: string, reportType: 'FULL' | 'SUMMARY' = 'FULL') => {
    try {
      const response = await fetch(`/api/v1/allergens/menus/${menuId}/compliance`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType }),
      });

      if (response.ok) {
        const data = await response.json();
        setComplianceReport(data.data);
        setActiveTab('compliance');
      }
    } catch (error) {
      console.error('Error generating compliance report:', error);
    }
  };

  const handleRecalculateAll = async () => {
    if (!confirm('¿Estás seguro de recalcular todos los alérgenos? Esta operación puede tardar varios minutos.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/allergens/recalculate-all', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${data.message}\n\nProductos: ${data.stats.products}\nRecetas: ${data.stats.recipes}\nMenús: ${data.stats.menus}`);
        await fetchData();
      }
    } catch (error) {
      console.error('Error recalculating allergens:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAllergenName = (allergenId: number) => {
    const allergen = ALLERGENS_INFO.find((a) => a.id === allergenId);
    return allergen ? allergen.name : `Alérgeno ${allergenId}`;
  };

  const getAllergenIcon = (allergenId: number) => {
    const allergen = ALLERGENS_INFO.find((a) => a.id === allergenId);
    return allergen ? allergen.icon : '⚠️';
  };

  const getAllergenColor = (allergenId: number) => {
    const allergen = ALLERGENS_INFO.find((a) => a.id === allergenId);
    return allergen ? allergen.color : 'gray';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Alérgenos</h1>
          <p className="text-gray-600">
            Sistema de trazabilidad automática de alérgenos - Cumplimiento UE 1169/2011
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg mb-8">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'products'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Productos
            </button>
            <button
              onClick={() => setActiveTab('recipes')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'recipes'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recetas
            </button>
            <button
              onClick={() => setActiveTab('menus')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'menus'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Menús
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'conflicts'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Conflictos
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'compliance'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cumplimiento
            </button>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg mb-8 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros de Alérgenos</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {ALLERGENS_INFO.map((allergen) => {
              const isSelected = selectedAllergens.includes(allergen.id);
              return (
                <button
                  key={allergen.id}
                  onClick={() => handleToggleAllergen(allergen.id)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center transition-all ${
                    isSelected
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-3xl mb-1">{allergen.icon}</span>
                  <span className="text-xs font-medium text-gray-700 text-center">{allergen.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setSelectedAllergens([])}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Limpiar Filtros
            </button>
            <button
              onClick={handleRecalculateAll}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Calculando...' : 'Recalcular Todo'}
            </button>
          </div>
        </div>

        {activeTab === 'products' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos con Alérgenos</h3>
            {loading ? (
              <p className="text-gray-500">Cargando productos...</p>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{product.name}</h4>
                      <div className="flex gap-2">
                        {product.allergens.length > 0 && (
                          <div className="flex gap-1">
                            {product.allergens.map((allergenId) => (
                              <span
                                key={allergenId}
                                className="text-2xl"
                                title={getAllergenName(allergenId)}
                              >
                                {getAllergenIcon(allergenId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {ALLERGENS_INFO.map((allergen) => (
                        <button
                          key={allergen.id}
                          onClick={() => {
                            const newAllergens = product.allergens.includes(allergen.id)
                              ? product.allergens.filter((id) => id !== allergen.id)
                              : [...product.allergens, allergen.id];
                            handleUpdateProductAllergens(product.id, newAllergens);
                          }}
                          className={`px-3 py-1 rounded-md text-sm ${
                            product.allergens.includes(allergen.id)
                              ? 'bg-red-100 text-red-700 border-2 border-red-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {allergen.icon} {allergen.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recetas con Alérgenos</h3>
            {loading ? (
              <p className="text-gray-500">Cargando recetas...</p>
            ) : (
              <div className="space-y-4">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{recipe.name}</h4>
                        {recipe.allergens.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {recipe.allergens.map((allergenId) => (
                              <span
                                key={allergenId}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800"
                                title={getAllergenName(allergenId)}
                              >
                                {getAllergenIcon(allergenId)} {getAllergenName(allergenId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleCalculateRecipeAllergens(recipe.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Recalcular
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'menus' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Menús con Alérgenos</h3>
            {loading ? (
              <p className="text-gray-500">Cargando menús...</p>
            ) : (
              <div className="space-y-4">
                {menus.map((menu) => (
                  <div key={menu.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{menu.name}</h4>
                        {menu.allergens.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {menu.allergens.map((allergenId) => (
                              <span
                                key={allergenId}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800"
                                title={getAllergenName(allergenId)}
                              >
                                {getAllergenIcon(allergenId)} {getAllergenName(allergenId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCalculateMenuAllergens(menu.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Recalcular
                        </button>
                        <button
                          onClick={() => handleDetectConflicts(menu.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Detectar Conflictos
                        </button>
                        <button
                          onClick={() => handleGenerateComplianceReport(menu.id, 'FULL')}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                          Reporte Cumplimiento
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conflictos Detectados</h3>
            {conflicts.length === 0 ? (
              <p className="text-gray-500">No hay conflictos detectados con los filtros seleccionados.</p>
            ) : (
              <div className="space-y-4">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">
                      Conflicto en Receta: {conflict.recipeId}
                    </h4>
                    <p className="text-sm text-gray-700 mb-2">Alérgenos conflictivos:</p>
                    <div className="flex gap-2">
                      {conflict.filteredAllergens.map((allergenId) => (
                        <span
                          key={allergenId}
                          className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-red-100 text-red-800"
                        >
                          {getAllergenIcon(allergenId)} {getAllergenName(allergenId)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && complianceReport && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reporte de Cumplimiento UE 1169/2011
            </h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Información del Reporte</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>ID Menú:</strong> {complianceReport.menuId}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Tipo:</strong> {complianceReport.reportType}
                  </p>
                </div>
              </div>

              {complianceReport.missingDeclarations && complianceReport.missingDeclarations.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-900 mb-2">⚠️ Declaraciones Faltantes</h4>
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-2">
                      Los siguientes productos no tienen declaraciones de alérgenos:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {complianceReport.missingDeclarations.map((productId, index) => (
                        <li key={index}>Producto ID: {productId}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {complianceReport.conflicts && complianceReport.conflicts.length > 0 && (
                <div>
                  <h4 className="font-medium text-orange-900 mb-2">⚠️ Conflictos Detectados</h4>
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-2">
                      Se detectaron {complianceReport.conflicts.length} conflictos en el menú
                    </p>
                  </div>
                </div>
              )}

              {(!complianceReport.missingDeclarations || complianceReport.missingDeclarations.length === 0) &&
                (!complianceReport.conflicts || complianceReport.conflicts.length === 0) && (
                  <div>
                    <h4 className="font-medium text-green-900 mb-2">✅ Cumplimiento Verificado</h4>
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        El menú cumple con todos los requisitos de la normativa UE 1169/2011.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}