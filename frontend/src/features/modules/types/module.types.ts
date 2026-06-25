/**
 * Module types for frontend.
 */

export interface Module {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  alwaysActive: boolean;
  enabled: boolean;
}

export interface ToggleModuleRequest {
  enabled: boolean;
}

export interface ModuleConflictError {
  error: string;
  message: string;
  conflicts: string[];
}

export type ModuleStatus = 'active' | 'inactive';