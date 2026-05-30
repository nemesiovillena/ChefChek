'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNotification } from '@/components/notification-system';

interface MenuItem {
  recipeId: string;
  recipeName?: string;
  price?: number;
  isAvailable?: boolean;
}

interface MenuSection {
  name: string;
  order: number;
  items: MenuItem[];
}

interface MenuTranslation {
  language: string;
  name: string;
  description?: string;
  sectionsTranslations?: Record<string, string>;
}

interface Menu {
  id: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  portions: number;
  isActive: boolean;
  sections: MenuSection[];
  translations?: MenuTranslation[];
  costBreakdown?: {
    totalCost: number;
    totalPrice: number;
    totalMargin: number;
    averageMarginPercentage: number;
    costPerPortion: number;
    pricePerPortion: number;
  };
}

export default function MenusPage() {
  const t = useTranslations('nav');
  const addNotification = useNotification();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [session, setSession] = useState<any>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Datos adicionales
  const [recipes, setRecipes] = useState<any[]>([]);
  const [qrCodeData, setQrCodeData] = useState<any>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    portions: 1,
    startDate: '',
    endDate: '',
    isActive: true,
  });

  const [sections, setSections] = useState<MenuSection[]>([
    {
      name: 'Primeros',
      order: 1,
      items: [],
    },
  ]);

  const [translations, setTranslations] = useState<MenuTranslation[]>([]);

  useEffect(() => {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      setSession(parsedSession.session);
      fetchMenus(parsedSession.session.token);
      fetchRecipes(parsedSession.session.token);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchMenus = async (token: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (showActiveOnly) queryParams.append('isActive', 'true');

      const response = await fetch(`http://localhost:3001/api/v1/menus?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setMenus(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch menus',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/recipes', {
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
      console.error('Error fetching recipes:', error);
    }
  };

  const handleCreateMenu = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const menuData = {
      name: formData.name,
      description: formData.description,
      portions: parseInt(formData.portions.toString()),
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      sections,
      translations,
      isActive: formData.isActive,
    };

    try {
      const response = await fetch('http://localhost:3001/api/v1/menus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
        body: JSON.stringify(menuData),
      });

      const data = await response.json();
      if (data.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Menu created successfully',
        });
        setShowCreateForm(false);
        fetchMenus(session?.token);
        resetForm();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create menu',
      });
    }
  };

  const handleAddSection = () => {
    const newOrder = sections.length + 1;
    setSections([...sections, {
      name: `Sección ${newOrder}`,
      order: newOrder,
      items: [],
    }]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleUpdateSection = (index: number, field: keyof MenuSection, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const handleAddItemToSection = (sectionIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].items.push({
      recipeId: '',
      price: 0,
      isAvailable: true,
    });
    setSections(updated);
  };

  const handleRemoveItemFromSection = (sectionIndex: number, itemIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].items = updated[sectionIndex].items.filter((_, i) => i !== itemIndex);
    setSections(updated);
  };

  const handleUpdateItem = (sectionIndex: number, itemIndex: number, field: keyof MenuItem, value: any) => {
    const updated = [...sections];
    updated[sectionIndex].items[itemIndex] = { ...updated[sectionIndex].items[itemIndex], [field]: value };

    // Auto-fill recipe name when selected
    if (field === 'recipeId') {
      const recipe = recipes.find(r => r.id === value);
      if (recipe) {
        updated[sectionIndex].items[itemIndex] = {
          ...updated[sectionIndex].items[itemIndex],
          recipeName: recipe.name,
          price: recipe.totalCost * 1.3, // 30% margin by default
        };
      }
    }

    setSections(updated);
  };

  const handleAddTranslation = () => {
    setTranslations([...translations, {
      language: 'es',
      name: '',
      description: '',
      sectionsTranslations: {},
    }]);
  };

  const handleRemoveTranslation = (index: number) => {
    setTranslations(translations.filter((_, i) => i !== index));
  };

  const handleUpdateTranslation = (index: number, field: keyof MenuTranslation, value: any) => {
    const updated = [...translations];
    updated[index] = { ...updated[index], [field]: value };
    setTranslations(updated);
  };

  const handleViewDetails = async (menuId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/menus/${menuId}`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setSelectedMenu(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch menu details',
      });
    }
  };

  const handleGenerateQRCode = async (menuId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/menus/${menuId}/qr-code`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setQrCodeData(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to generate QR code',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      portions: 1,
      startDate: '',
      endDate: '',
      isActive: true,
    });
    setSections([
      {
        name: 'Primeros',
        order: 1,
        items: [],
      },
    ]);
    setTranslations([]);
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
          <h1 className="text-3xl font-bold text-gray-900">Menus</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : 'Create Menu'}
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchMenus(session?.token)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search menus..."
              />
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Show Active Only</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => fetchMenus(session?.token)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                setShowActiveOnly(true);
                fetchMenus(session?.token);
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
            <h2 className="text-xl font-semibold mb-4">Create New Menu</h2>
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Secciones del Menú */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Menu Sections</h3>
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    + Add Section
                  </button>
                </div>
                {sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="border border-gray-200 rounded-md p-4 mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex space-x-2 flex-1">
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => handleUpdateSection(sectionIndex, 'name', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Section Name"
                        />
                        <input
                          type="number"
                          min="0"
                          value={section.order}
                          onChange={(e) => handleUpdateSection(sectionIndex, 'order', parseInt(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Order"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(sectionIndex)}
                        className="ml-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Items</h4>
                      <button
                        type="button"
                        onClick={() => handleAddItemToSection(sectionIndex)}
                        className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        + Add Item
                      </button>
                    </div>
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex space-x-2 mb-2">
                        <select
                          value={item.recipeId}
                          onChange={(e) => handleUpdateItem(sectionIndex, itemIndex, 'recipeId', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Recipe</option>
                          {recipes.map(recipe => (
                            <option key={recipe.id} value={recipe.id}>
                              {recipe.name} (€{recipe.totalCost.toFixed(2)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleUpdateItem(sectionIndex, itemIndex, 'price', parseFloat(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Price"
                        />
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={item.isAvailable}
                            onChange={(e) => handleUpdateItem(sectionIndex, itemIndex, 'isAvailable', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">Available</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromSection(sectionIndex, itemIndex)}
                          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Traducciones */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Translations</h3>
                  <button
                    type="button"
                    onClick={handleAddTranslation}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    + Add Translation
                  </button>
                </div>
                {translations.map((translation, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                        <select
                          value={translation.language}
                          onChange={(e) => handleUpdateTranslation(index, 'language', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="es">Español</option>
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                          <option value="it">Italiano</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Translated Name</label>
                        <input
                          type="text"
                          value={translation.name}
                          onChange={(e) => handleUpdateTranslation(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Menu name in this language"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={translation.description}
                        onChange={(e) => handleUpdateTranslation(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Description in this language"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTranslation(index)}
                      className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove Translation
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Menu
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

        {/* Lista de Menús */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Menu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost/Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin
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
              {menus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No menus found
                  </td>
                </tr>
              ) : (
                menus.map((menu) => (
                  <tr key={menu.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{menu.name}</div>
                        {menu.description && (
                          <div className="text-sm text-gray-500">{menu.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {menu.sections.length} sections · {menu.portions} portions
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {menu.startDate && menu.endDate ? (
                        `${new Date(menu.startDate).toLocaleDateString()} - ${new Date(menu.endDate).toLocaleDateString()}`
                      ) : (
                        'No period'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">€{menu.costBreakdown?.totalPrice.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-500">Cost: €{menu.costBreakdown?.totalCost.toFixed(2) || '0.00'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">
                        {menu.costBreakdown?.averageMarginPercentage.toFixed(1)}% margin
                      </div>
                      <div className="text-xs text-gray-500">
                        €{menu.costBreakdown?.totalMargin.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        menu.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {menu.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetails(menu.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleGenerateQRCode(menu.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          QR
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

      {/* Modal QR Code */}
      {qrCodeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">QR Code</h3>
              <button
                onClick={() => setQrCodeData(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img src={qrCodeData.qrCode} alt="QR Code" className="w-full" />
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">URL:</p>
              <code className="block w-full p-2 bg-gray-100 rounded text-sm break-all">
                {qrCodeData.url}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}