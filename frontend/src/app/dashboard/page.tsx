'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('nav');
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      setUser(parsedSession.user);
      setSession(parsedSession.session);
      setLoading(false);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const handleLogout = async () => {
    try {
      if (session) {
        await fetch('http://localhost:3001/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ sessionId: session.id }),
        });
      }
      localStorage.removeItem('session');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('session');
      window.location.href = '/login';
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
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ChefChek</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user?.name} ({user?.role})
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <a href="/dashboard" className="border-b-2 border-indigo-500 py-4 px-1 text-sm font-medium text-indigo-600">
              {t('dashboard')}
            </a>
            <a href="/dashboard/products" className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
              {t('products')}
            </a>
            <a href="/dashboard/recipes" className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
              {t('recipes')}
            </a>
            <a href="/dashboard/menus" className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
              {t('menus')}
            </a>
            <a href="/dashboard/warehouse" className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
              {t('warehouse')}
            </a>
            <a href="/dashboard/settings" className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
              {t('settings')}
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            {t('dashboard')}
          </h2>
          <p className="mt-2 text-gray-600">
            Welcome back, {user?.name}!
          </p>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Products
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                0
              </dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Recipes
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                0
              </dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Menus
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                0
              </dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Active Users
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                1
              </dd>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Activity
            </h3>
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}