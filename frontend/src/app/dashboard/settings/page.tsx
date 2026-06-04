'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const t = useTranslations('nav');
  const { user, session, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
  });

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  useEffect(() => {
    if (session?.id && user?.tenantId) {
      fetchTenantConfig(session?.id, user?.tenantId);
    }
  }, [session, user]);

  const fetchTenantConfig = async (sessionId: string, tenantId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/tenants/${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'X-Tenant-Slug': 'default',
        },
      });

      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setFormData({
          name: data.data.name,
          domain: data.data.domain || '',
        });
      }
    } catch (error) {
      console.error('Error fetching tenant config:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !session?.id) return;

    try {
      const response = await fetch(`http://localhost:3001/api/v1/tenants/${config.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.id}`,
          'X-Tenant-Slug': 'default',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setEditing(false);
      }
    } catch (error) {
      console.error('Error saving tenant config:', error);
    }
  };

  const handleLanguageChange = async (language: string) => {
    // In production, save language preference to user/tenant config
    console.log('Language changed to:', language);
  };

  const handleCurrencyChange = async (currency: string) => {
    // In production, save currency preference to tenant config
    console.log('Currency changed to:', currency);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('settings')}</h1>

        {/* Tenant Information */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Tenant Information</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Domain (Optional)
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="yourdomain.com"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Tenant ID:</span>
                <span className="font-mono text-sm">{config?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tenant Slug:</span>
                <span className="font-mono text-sm">{config?.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{config?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Custom Domain:</span>
                <span className="font-medium">{config?.domain || 'Not configured'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  config?.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {config?.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">
                  {config?.createdAt ? new Date(config.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Language Settings */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">Language Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Language
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onChange={(e) => handleLanguageChange(e.target.value)}
              defaultValue="es"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>

        {/* Currency Settings */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">Currency Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Currency
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onChange={(e) => handleCurrencyChange(e.target.value)}
              defaultValue="EUR"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CHF">CHF (Fr)</option>
            </select>
          </div>
        </div>

        {/* Module Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Modules</h2>
          <div className="space-y-3">
            {['Core', 'Escandallos', 'Seguridad', 'Producción', 'Almacenes'].map((module) => (
              <div key={module} className="flex items-center justify-between">
                <span className="text-gray-700">{module}</span>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}