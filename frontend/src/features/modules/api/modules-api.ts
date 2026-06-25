/**
 * API client for module management.
 */

import { apiClient } from '@/lib/api-client';
import { Module, ToggleModuleRequest, ModuleConflictError } from '../types/module.types';

const MODULES_BASE_URL = '/v1/modules';

/**
 * Fetch all modules with their current activation states.
 */
export async function fetchModuleStates(): Promise<Module[]> {
  const response = await apiClient.get<Module[]>(MODULES_BASE_URL);
  return response.data;
}

/**
 * Toggle a module's activation state.
 */
export async function toggleModule(
  moduleId: string,
  enabled: boolean,
): Promise<Module> {
  const request: ToggleModuleRequest = { enabled };
  const response = await apiClient.patch<Module>(
    `${MODULES_BASE_URL}/${moduleId}`,
    request,
  );
  return response.data;
}

/**
 * Check if an error is a module conflict error.
 */
export function isModuleConflictError(
  error: unknown,
): error is ModuleConflictError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as any).error === 'DEPENDENCY_CONFLICT'
  );
}