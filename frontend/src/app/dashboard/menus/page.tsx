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

  // Handle authentication redirect in useEffect, not in render
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
    } catch (_error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch menus',
      });
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      Promise.resolve().then(fetchMenus);
    }
  }, [isAuthenticated]);

  // Don't render anything if not authenticated or loading
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cambiar el estado del menú';
      addNotification({
        type: 'error',
        title: 'Error',
        message,
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
    <div className="w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Menús</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            {showCreateForm ? 'Cancelar' : 'Crear Menú'}
          </button>
        </div>

        {/* Formulario de Creación */}
        {showCreateForm && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Crear Nuevo Menú</h2>
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Menú *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Crear Menú
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-zinc-850 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-zinc-750 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Menús */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Menú
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {menus.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron menús
                    </td>
                  </tr>
                ) : (
                  menus.map((menu) => (
                    <tr key={menu.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{menu.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(menu.createdAt).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewDetails(menu.id)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:underline font-semibold"
                        >
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Detalles */}
        {selectedMenu && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6 max-w-2xl w-full shadow-2xl">
              <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{selectedMenu.name}</h3>
              <div className="space-y-3">
                {selectedMenu.description && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Descripción:</span>
                    <p className="mt-1 text-gray-900 dark:text-white">{selectedMenu.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    selectedMenu.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {selectedMenu.isActive ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Creado:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {new Date(selectedMenu.createdAt).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedMenu(null)}
                  className="px-4 py-2 bg-gray-300 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}