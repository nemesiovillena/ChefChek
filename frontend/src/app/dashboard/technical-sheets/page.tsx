'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface Template {
  id: string;
  name: string;
  type: 'STANDARD' | 'MINIMAL' | 'DETAILED' | 'CUSTOM';
  description?: string;
  createdAt: string;
  createdBy: string;
}

interface Document {
  id: string;
  name: string;
  type: 'TECHNICAL_SHEET' | 'RECIPE_CARD' | 'INSTRUCTION' | 'OTHER';
  category: string;
  recipeId?: string;
  templateId?: string;
  version: number;
  createdAt: string;
  fileSize: number;
  fileFormat: 'PDF' | 'DOCX';
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  ingredients?: Array<{
    product: {
      name: string;
      allergens?: number[];
      cost?: number;
    };
    quantity: number;
    unit?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default function TechnicalSheetsPage() {
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

  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'generator' | 'documents' | 'preview'>('templates');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, documentsRes, recipesRes] = await Promise.all([
        fetch('/api/v1/technical-sheets/templates'),
        fetch('/api/v1/technical-sheets/documents'),
        fetch('/api/v1/recipes'),
      ]);

      const templatesData = await templatesRes.json();
      const documentsData = await documentsRes.json();
      const recipesData = await recipesRes.json();

      setTemplates(templatesData.data || []);
      setDocuments(documentsData.data || []);
      setRecipes(recipesData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    const name = prompt('Nombre de la plantilla:');
    if (!name) return;

    const type = prompt('Tipo de plantilla (STANDARD, MINIMAL, DETAILED, CUSTOM):') || 'STANDARD';

    try {
      const response = await fetch('/api/v1/technical-sheets/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      const response = await fetch(`/api/v1/technical-sheets/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleGenerateSheet = async (recipeId: string, templateId: string, preview: boolean = false) => {
    if (!templateId) {
      alert('Selecciona una plantilla');
      return;
    }

    try {
      const endpoint = preview
        ? '/api/v1/technical-sheets/preview'
        : '/api/v1/technical-sheets/generate';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId,
          templateId,
          format: 'A4',
          orientation: 'PORTRAIT',
          quality: 'HIGH',
          includeNutrition: true,
          includeAllergens: true,
          includeCosts: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (preview) {
          setPreviewData(data.data.base64);
          setActiveTab('preview');
        } else {
          alert('Ficha técnica generada correctamente');
          await fetchData();
        }
      }
    } catch (error) {
      console.error('Error generating sheet:', error);
    }
  };

  const handleGenerateBatch = async () => {
    if (selectedRecipes.length === 0) {
      alert('Selecciona al menos una receta');
      return;
    }

    if (!selectedTemplate) {
      alert('Selecciona una plantilla');
      return;
    }

    if (!confirm(`Generar ${selectedRecipes.length} fichas técnicas`)) {
      return;
    }

    try {
      const response = await fetch('/api/v1/technical-sheets/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeIds: selectedRecipes,
          templateId: selectedTemplate,
          format: 'A4',
          orientation: 'PORTRAIT',
          quality: 'HIGH',
          mergeIntoOne: true,
        }),
      });

      if (response.ok) {
        alert('Fichas técnicas generadas correctamente');
        await fetchData();
        setSelectedRecipes([]);
      }
    } catch (error) {
      console.error('Error generating batch:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      const response = await fetch(`/api/v1/technical-sheets/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleDownloadDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/v1/technical-sheets/documents/${documentId}`);
      const data = await response.json();

      if (data.success && data.data.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const toggleRecipeSelection = (recipeId: string) => {
    setSelectedRecipes((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fichas Técnicas</h1>
          <p className="text-gray-600">
            Sistema de generación de fichas técnicas parametrizadas con exportación PDF
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg mb-8">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'templates'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Plantillas
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'generator'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Generador
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 py-4 px-6 text-sm font-medium ${
                activeTab === 'documents'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Documentos
            </button>
            {previewData && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-4 px-6 text-sm font-medium ${
                  activeTab === 'preview'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Vista Previa
              </button>
            )}
          </div>
        </div>

        {activeTab === 'templates' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Plantillas Disponibles</h3>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                + Nueva Plantilla
              </button>
            </div>

            {loading ? (
              <p className="text-gray-500">Cargando plantillas...</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay plantillas creadas</p>
                <button
                  onClick={handleCreateTemplate}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Crear Primera Plantilla
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                        {template.type}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedTemplate(template.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                      >
                        Seleccionar
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Creado: {new Date(template.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'generator' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Generador de Fichas Técnicas</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plantilla Seleccionada
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar plantilla...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-900">Recetas</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRecipes(recipes.map((r) => r.id))}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Seleccionar Todo
                  </button>
                  <button
                    onClick={() => setSelectedRecipes([])}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedRecipes.includes(recipe.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleRecipeSelection(recipe.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-medium text-gray-900">{recipe.name}</h5>
                        {recipe.description && (
                          <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedRecipes.includes(recipe.id)}
                        onChange={() => toggleRecipeSelection(recipe.id)}
                        className="h-4 w-4 text-indigo-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleGenerateBatch}
                disabled={!selectedTemplate || selectedRecipes.length === 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Generar Batch ({selectedRecipes.length} fichas)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Documentos Generados</h3>

            {loading ? (
              <p className="text-gray-500">Cargando documentos...</p>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay documentos generados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((document) => (
                  <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{document.name}</h4>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          <span>Tipo: {document.type}</span>
                          <span>Versión: {document.version}</span>
                          <span>Tamaño: {formatFileSize(document.fileSize)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Creado: {new Date(document.createdAt).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownloadDocument(document.id)}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                        >
                          Descargar
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'preview' && previewData && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Vista Previa</h3>
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
            <div className="border border-gray-300 rounded-lg">
              <iframe
                src={`data:application/pdf;base64,${previewData}`}
                className="w-full h-96"
                title="Vista previa PDF"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}