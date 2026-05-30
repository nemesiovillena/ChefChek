'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNotification } from '@/components/notification-system';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  supplier?: string;
  purchaseUnit: string;
  storageUnit: string;
  recipeUnit: string;
  purchasePrice: number;
  netPrice: number;
  profitMargin: number;
  wastePercentage: number;
  yieldFactor: number;
  allergens: number[];
  isActive: boolean;
}

export default function ProductsPage() {
  const t = useTranslations('nav');
  const addNotification = useNotification();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [session, setSession] = useState<any>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');

  // Datos adicionales
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costCalculation, setCostCalculation] = useState<any>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      setSession(parsedSession.session);
      fetchProducts(parsedSession.session.token);
      fetchCategories(parsedSession.session.token);
      fetchSuppliers(parsedSession.session.token);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchProducts = async (token: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (selectedCategory) queryParams.append('category', selectedCategory);
      if (selectedSupplier) queryParams.append('supplier', selectedSupplier);

      const response = await fetch(`http://localhost:3001/api/v1/products?${queryParams}`, {
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
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch products',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/products/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSuppliers = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/products/suppliers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const productData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      supplier: formData.get('supplier') as string,
      purchaseUnit: formData.get('purchaseUnit') as string,
      storageUnit: formData.get('storageUnit') as string,
      recipeUnit: formData.get('recipeUnit') as string,
      purchasePrice: parseFloat(formData.get('purchasePrice') as string),
      wastePercentage: parseFloat(formData.get('wastePercentage') as string) || 0,
      profitMargin: parseFloat(formData.get('profitMargin') as string) || 0,
      allergens: formData.get('allergens') as string ? JSON.parse(formData.get('allergens') as string) : [],
    };

    try {
      const response = await fetch('http://localhost:3001/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();
      if (data.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Product created successfully',
        });
        setShowCreateForm(false);
        fetchProducts(session?.token);
        e.currentTarget.reset();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create product',
      });
    }
  };

  const handleViewDetails = async (productId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setSelectedProduct(data.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch product details',
      });
    }
  };

  const handleCalculateCost = async (productId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/products/${productId}/calculate`, {
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setCostCalculation(data.data);
        setShowCostModal(true);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to calculate product cost',
      });
    }
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
          <h1 className="text-3xl font-bold text-gray-900">{t('products')}</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : 'Create Product'}
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchProducts(session?.token)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search products..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((sup) => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => fetchProducts(session?.token)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedSupplier('');
                fetchProducts(session?.token);
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
            <h2 className="text-xl font-semibold mb-4">Create New Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input
                    name="category"
                    type="text"
                    required
                    list="categories-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="categories-list">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    name="supplier"
                    type="text"
                    list="suppliers-list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map((sup) => (
                      <option key={sup} value={sup} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Multi-unidad */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Multi-Unit System</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Unit (UC) *</label>
                    <input
                      name="purchaseUnit"
                      type="text"
                      required
                      placeholder="Caja 10kg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Storage Unit (UA) *</label>
                    <input
                      name="storageUnit"
                      type="text"
                      required
                      placeholder="Kilogramos"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Unit (UR) *</label>
                    <input
                      name="recipeUnit"
                      type="text"
                      required
                      placeholder="Gramos"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Precios */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (€) *</label>
                    <input
                      name="purchasePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Waste Percentage (%)</label>
                    <input
                      name="wastePercentage"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profit Margin (%)</label>
                    <input
                      name="profitMargin"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Alérgenos */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Allergens</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergens (comma-separated)</label>
                  <input
                    name="allergens"
                    type="text"
                    placeholder="1,2,3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">1=Cereales, 2=Crustáceos, 3=Huevos...</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Product
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

        {/* Lista de Productos */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units (UC/UA/UR)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
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
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-gray-500">{product.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{product.purchaseUnit} / {product.storageUnit} / {product.recipeUnit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">€{product.purchasePrice.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Net: €{product.netPrice.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetails(product.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleCalculateCost(product.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Calculate
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