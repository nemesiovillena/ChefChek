'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { AI_PROVIDERS, getApiKey, setApiKey } from '@/lib/ai-api-keys';
import { Key, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react';
import { ModuleListWidget } from '@/features/modules/components/module-list-widget';

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
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
  });

  // API keys state: provider id → key value
  const [apiKeys, setApiKeysState] = useState<Record<string, string>>(() => {
    const loaded: Record<string, string> = {};
    AI_PROVIDERS.forEach(p => {
      loaded[p.id] = getApiKey(p.id);
    });
    return loaded;
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  // Handle authentication redirect in useEffect, not in render
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.tenantId) return;
    const tenantId = user.tenantId;
    let cancelled = false;
    const fetchData = async () => {
      const sessionId = sessionStorage.getItem('session_id');
      const tenantSlug = sessionStorage.getItem('tenant_slug');

      if (!sessionId || !tenantSlug) {
        if (!cancelled) setPageLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/api/v1/tenants/${tenantId}`, {
          headers: {
            'Authorization': `Bearer ${sessionId}`,
            'X-Tenant-Slug': tenantSlug,
          },
        });

        const data = await response.json();
        if (cancelled) return;
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
        if (!cancelled) setPageLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.tenantId]);

  // Don't render anything if not authenticated or loading
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const handleApiKeyChange = (providerId: string, key: string) => {
    setApiKeysState(prev => ({ ...prev, [providerId]: key }));
    setSavedKeys(prev => ({ ...prev, [providerId]: false }));
  };

  const handleApiKeySave = (providerId: string) => {
    setApiKey(providerId, apiKeys[providerId] || '');
    setSavedKeys(prev => ({ ...prev, [providerId]: true }));
    setTimeout(() => {
      setSavedKeys(prev => ({ ...prev, [providerId]: false }));
    }, 2000);
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  /** Simple validation: key starts with expected prefix */
  const isKeyValid = (providerId: string): boolean | null => {
    const key = apiKeys[providerId];
    if (!key) return null;
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    return provider ? key.startsWith(provider.keyPrefix) : true;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!config) return;

    try {
      const sessionId = sessionStorage.getItem('session_id');
      const tenantSlug = sessionStorage.getItem('tenant_slug');

      if (!sessionId || !tenantSlug) {
        alert('No session found. Please log in again.');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/v1/tenants/${config.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
          'X-Tenant-Slug': tenantSlug,
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Configuración</h1>

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
        <ModuleListWidget />

        {/* API Keys */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold">APIs</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Configura las claves API de los proveedores de IA para la extracción de datos de albaranes.
            Las claves se guardan solo en tu navegador y nunca se envían al servidor.
          </p>
          <div className="space-y-6">
            {AI_PROVIDERS.map((provider) => {
              const hasKey = !!apiKeys[provider.id];
              const validity = isKeyValid(provider.id);
              const isSaved = savedKeys[provider.id];
              const isShown = showKeys[provider.id];

              return (
                <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{provider.name}</span>
                      {hasKey && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="h-3 w-3" /> Configurada
                        </span>
                      )}
                    </div>
                    {validity === false && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Formato inesperado
                      </span>
                    )}
                  </div>

                  {/* Available models for this provider */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {provider.models.map(m => (
                      <span key={m.id} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {m.name}
                      </span>
                    ))}
                  </div>

                  {/* API Key Input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isShown ? 'text' : 'password'}
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                        placeholder={provider.keyPlaceholder}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {isShown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApiKeySave(provider.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isSaved
                          ? 'bg-green-600 text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isSaved ? '✓ Guardada' : 'Guardar'}
                    </button>
                    {hasKey && (
                      <button
                        type="button"
                        onClick={() => {
                          handleApiKeyChange(provider.id, '');
                          handleApiKeySave(provider.id);
                        }}
                        className="px-3 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}