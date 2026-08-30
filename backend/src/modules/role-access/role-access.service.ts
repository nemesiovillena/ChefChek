import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { ModulesService } from "../modules/modules.service";
import {
  SECTION_REGISTRY,
  SECTION_KEYS,
  SECTION_BYPASS_ROLES,
  ROLE_ACCESS_ROLES,
  RoleAccessRole,
  isRoleAccessRole,
} from "./constants/section-registry";
import { UpdateRoleAccessDto } from "./dto/role-access.dto";

const CONFIG_PREFIX = "roleAccess.";
const CONFIG_CATEGORY = "ROLE_ACCESS";

export interface RoleAccessConfigResponse {
  sections: {
    key: string;
    label: string;
    parent?: string;
    moduleId?: string;
  }[];
  USER: Record<string, boolean>;
  VIEWER: Record<string, boolean>;
}

/**
 * Resolves which sections (apartados) a USER/VIEWER can see for a given tenant.
 *
 * - ADMIN/OWNER/SUPERADMIN bypass all gating.
 * - No config row for a (role, section) -> section default (always `true`).
 * - A section backed by a module that is disabled for the tenant -> `false`.
 */
@Injectable()
export class RoleAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesService: ModulesService,
  ) {}

  private configKey(role: RoleAccessRole, sectionKey: string): string {
    return `${CONFIG_PREFIX}${role}.${sectionKey}`;
  }

  /** Flat `{ 'recipes': true, 'recipes.cost': false, ... }` map for one role. */
  async getRoleSectionMap(
    tenantId: string,
    role: RoleAccessRole,
  ): Promise<Record<string, boolean>> {
    const prefix = `${CONFIG_PREFIX}${role}.`;
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { startsWith: prefix } },
    });

    const explicit = new Map<string, boolean>();
    for (const row of rows) {
      explicit.set(row.key.slice(prefix.length), row.value === "true");
    }

    const moduleStates = await this.modulesService.getModules(tenantId);
    const enabledModules = new Set(
      moduleStates.filter((m) => m.enabled).map((m) => m.id),
    );

    const map: Record<string, boolean> = {};
    for (const section of SECTION_REGISTRY) {
      if (section.moduleId && !enabledModules.has(section.moduleId)) {
        map[section.key] = false;
        continue;
      }
      map[section.key] = explicit.has(section.key)
        ? (explicit.get(section.key) as boolean)
        : section.defaultAllowed;
    }
    return map;
  }

  /** Whether `role` may access `sectionKey` in `tenantId`. */
  async isSectionAllowed(
    tenantId: string,
    role: string | undefined,
    sectionKey: string,
  ): Promise<boolean> {
    if (role && SECTION_BYPASS_ROLES.includes(role)) {
      return true;
    }
    if (!role || !isRoleAccessRole(role)) {
      return false;
    }
    const map = await this.getRoleSectionMap(tenantId, role);
    // Unknown section keys are treated as allowed (not gated).
    return map[sectionKey] ?? true;
  }

  /** Config payload for the settings screen: both role columns + section list. */
  async getRoleAccessConfig(
    tenantId: string,
  ): Promise<RoleAccessConfigResponse> {
    const moduleStates = await this.modulesService.getModules(tenantId);
    const enabledModules = new Set(
      moduleStates.filter((m) => m.enabled).map((m) => m.id),
    );

    const sections = SECTION_REGISTRY.filter(
      (s) => !s.moduleId || enabledModules.has(s.moduleId),
    ).map((s) => ({
      key: s.key,
      label: s.label,
      parent: s.parent,
      moduleId: s.moduleId,
    }));

    const [user, viewer] = await Promise.all([
      this.getRoleSectionMap(tenantId, "USER"),
      this.getRoleSectionMap(tenantId, "VIEWER"),
    ]);

    return { sections, USER: user, VIEWER: viewer };
  }

  /** Persists explicit `true`/`false` rows for the given (role, section) pairs. */
  async updateRoleAccess(
    tenantId: string,
    userId: string,
    dto: UpdateRoleAccessDto,
  ): Promise<RoleAccessConfigResponse> {
    for (const role of ROLE_ACCESS_ROLES) {
      const flags = dto[role];
      if (!flags) {
        continue;
      }

      for (const [sectionKey, value] of Object.entries(flags)) {
        if (!SECTION_KEYS.has(sectionKey)) {
          throw new BadRequestException(`Unknown section key: '${sectionKey}'`);
        }
        if (typeof value !== "boolean") {
          throw new BadRequestException(
            `Value for '${role}.${sectionKey}' must be a boolean`,
          );
        }

        const key = this.configKey(role, sectionKey);
        await this.prisma.configuration.upsert({
          where: { tenantId_key: { tenantId, key } },
          create: {
            tenantId,
            key,
            value: String(value),
            category: CONFIG_CATEGORY,
            description: `Role access for ${role}: ${sectionKey}`,
            updatedBy: userId,
          },
          update: { value: String(value), updatedBy: userId },
        });
      }
    }

    return this.getRoleAccessConfig(tenantId);
  }
}
