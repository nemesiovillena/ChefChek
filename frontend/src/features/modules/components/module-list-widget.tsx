'use client';

import React, { useEffect, useState } from 'react';
import { useModules } from '../hooks/use-modules';
import { Switch } from '@/components/ui/switch';
import { Check, X, AlertCircle } from 'lucide-react';

export function ModuleListWidget() {
  const { modules, loading, error, toggleEnabled, refetch } = useModules();

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Modules</h2>
        <div className="text-gray-500">Loading modules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Modules</h2>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-4 text-indigo-600 hover:text-indigo-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Active Modules</h2>
      <div className="space-y-3">
        {modules?.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            onToggle={(enabled) => toggleEnabled(module.id, enabled)}
          />
        ))}
      </div>
    </div>
  );
}

interface ModuleCardProps {
  module: {
    id: string;
    name: string;
    description: string;
    dependencies: string[];
    alwaysActive: boolean;
    enabled: boolean;
  };
  onToggle: (enabled: boolean) => Promise<void>;
}

function ModuleCard({ module, onToggle }: ModuleCardProps) {
  const [toggling, setToggling] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    setLocalError(null);
    try {
      await onToggle(checked);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Failed to update module');
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-start justify-between py-3 border-b last:border-b-0">
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{module.name}</span>
          {module.enabled ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 flex items-center gap-1">
              <X className="h-3 w-3" />
              Inactive
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">{module.description}</p>
        {localError && (
          <div className="mt-2 text-sm text-red-600 flex items-start gap-1">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{localError}</span>
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        <Switch
          checked={module.enabled}
          onCheckedChange={handleToggle}
          disabled={module.alwaysActive || toggling}
        />
        {module.alwaysActive && (
          <div className="text-xs text-gray-500 text-center mt-1">
            Always active
          </div>
        )}
      </div>
    </div>
  );
}