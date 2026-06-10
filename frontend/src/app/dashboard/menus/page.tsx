'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-system';

export const dynamic = 'force-dynamic';

interface Menu {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export default function MenusPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Handle authentication redirect in useEffect, not in render
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMenus();
    }
  }, []);

  // Don't render anything if not authenticated or loading
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  const fetchMenus = async () => {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      const tenantSlug = sessionStorage.getItem('tenant_slug');

      if (!sessionId || !tenantSlug) {
        setPageLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/v1/menus', {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'X-Tenant-Slug': tenantSlug,
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
      setPageLoading(false);
    }
  };

  const handleCreateMenu = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const menuData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    };

    try {
      const response = await fetch('http://localhost:3001/api/v1/menus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
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
        fetchMenus();
        e.currentTarget.reset();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to create menu',
      });
    }
  };

  const handleViewDetails = async (menuId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/menus/${menuId}`, {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
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

  const handleToggleStatus = async (menu: Menu) => {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      const tenantSlug = sessionStorage.getItem('tenant_slug');

      if (!sessionId || !tenantSlug) {
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se encontró una sesión activa.',
        });
        return;
      }

      const response = await fetch(`http://localhost:3001/api/v1/menus/${menu.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
          'X-Tenant-Slug': tenantSlug,
        },
        body: JSON.stringify({ isActive: !menu.isActive }),
      });

      const data = await response.json();
      if (data.success) {
        addNotification({
          type: 'success',
          title: 'Estado actualizado',
          message: `El menú "${menu.name}" ha sido ${!menu.isActive ? 'activado' : 'desactivado'}`,
        });
        fetchMenus();
      } else {
        addNotification({
          type: 'error',
          title: 'Error',
          message: data.message || 'Error al cambiar el estado del menú',
        });
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error al cambiar el estado del menú',
      });
    }
  };

  if (isLoading || pageLoading) {
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

        {/* Formulario de Creación */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Menu</h2>
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Menu Name *
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
                  Create Menu
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

        {/* Lista de Menús */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Menu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No menus found
                  </td>
                </tr>
              ) : (
                menus.map((menu) => (
                  <tr key={menu.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{menu.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {menu.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(menu)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150 ${
                          menu.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {menu.isActive ? 'Activo' : 'Desactivado'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(menu.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewDetails(menu.id)}
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
        {selectedMenu && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <h3 className="text-2xl font-bold mb-4">{selectedMenu.name}</h3>
              <div className="space-y-3">
                {selectedMenu.description && (
                  <div>
                    <span className="text-gray-600">Description:</span>
                    <p className="mt-1">{selectedMenu.description}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Estado:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                    selectedMenu.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {selectedMenu.isActive ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2">
                    {new Date(selectedMenu.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => setSelectedMenu(null)}
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