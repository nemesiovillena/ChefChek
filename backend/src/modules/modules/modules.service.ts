import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ModuleDto, UpdateModuleDto } from './dto/module.dto';
import {
  MODULE_REGISTRY,
  findModule,
  getDependentModules,
} from './constants/registry';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all modules with their current activation states.
   */
  async getModules(tenantId: string): Promise<ModuleDto[]> {
    // Fetch all module configurations for this tenant
    const configs = await this.prisma.configuration.findMany({
      where: {
        tenantId,
        key: { startsWith: 'modules.' },
      },
    });

    // Build a map of current states
    const stateMap = new Map<string, boolean>();
    for (const config of configs) {
      const moduleId = config.key.replace('modules.', '').replace('.enabled', '');
      stateMap.set(moduleId, config.value === 'true');
    }

    // Return all modules with their states
    return MODULE_REGISTRY.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      dependencies: def.dependencies,
      alwaysActive: def.alwaysActive,
      enabled: stateMap.get(def.id) ?? def.defaultEnabled,
    }));
  }

  /**
   * Toggle a module's activation state.
   */
  async toggleModule(
    tenantId: string,
    moduleId: string,
    dto: UpdateModuleDto,
    userId: string,
  ): Promise<ModuleDto> {
    const module = findModule(moduleId);

    if (!module) {
      throw new NotFoundException(`Module '${moduleId}' not found`);
    }

    // Prevent disabling always-active modules
    if (!dto.enabled && module.alwaysActive) {
      throw new ForbiddenException(
        `Module '${moduleId}' is always active and cannot be disabled`,
      );
    }

    // Check for dependency conflicts when disabling
    if (!dto.enabled) {
      const dependents = getDependentModules(moduleId);
      const activeDependents: string[] = [];

      // Check which dependents are currently active
      for (const dep of dependents) {
        const state = await this.getModuleState(tenantId, dep.id);
        if (state) {
          activeDependents.push(dep.name);
        }
      }

      if (activeDependents.length > 0) {
        throw new BadRequestException({
          error: 'DEPENDENCY_CONFLICT',
          message: `Cannot disable '${module.name}' - the following modules depend on it: ${activeDependents.join(', ')}`,
          conflicts: dependents.map((d) => d.id),
        });
      }
    }

    // Update or create the configuration
    const configKey = `modules.${moduleId}.enabled`;
    await this.prisma.configuration.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: configKey,
        },
      },
      create: {
        tenantId,
        key: configKey,
        value: String(dto.enabled),
        category: 'MODULES',
        description: `Activation state for ${module.name} module`,
        updatedBy: userId,
      },
      update: {
        value: String(dto.enabled),
        updatedBy: userId,
      },
    });

    // Return the updated module state
    return this.getModuleDto(tenantId, module);
  }

  /**
   * Get the activation state of a specific module.
   */
  private async getModuleState(
    tenantId: string,
    moduleId: string,
  ): Promise<boolean | null> {
    const config = await this.prisma.configuration.findFirst({
      where: {
        tenantId,
        key: `modules.${moduleId}.enabled`,
      },
    });

    return config ? config.value === 'true' : null;
  }

  /**
   * Build a ModuleDto for a specific module definition.
   */
  private async getModuleDto(
    tenantId: string,
    def: { id: string; name: string; description: string; dependencies: string[]; alwaysActive: boolean; defaultEnabled: boolean },
  ): Promise<ModuleDto> {
    const state = await this.getModuleState(tenantId, def.id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      dependencies: def.dependencies,
      alwaysActive: def.alwaysActive,
      enabled: state ?? def.defaultEnabled,
    };
  }
}