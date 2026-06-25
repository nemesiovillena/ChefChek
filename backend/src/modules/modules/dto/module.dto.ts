import { IsBoolean, IsString, IsOptional } from 'class-validator';

/**
 * Module state as returned to the frontend.
 */
export class ModuleDto {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  alwaysActive: boolean;
  enabled: boolean;
}

/**
 * Request to toggle module activation.
 */
export class UpdateModuleDto {
  @IsBoolean()
  enabled: boolean;
}

/**
 * Error response for module toggle conflicts.
 */
export class ModuleConflictErrorDto {
  error: string;
  message: string;
  conflicts: string[]; // Module IDs that would be affected
}