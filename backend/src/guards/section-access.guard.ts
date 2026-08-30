import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleAccessService } from "../modules/role-access/role-access.service";
import { SECTION_BYPASS_ROLES } from "../modules/role-access/constants/section-registry";

export const SECTION_METADATA_KEY = "section";
export const SECTION_ANY_METADATA_KEY = "section-any";

/**
 * Declares which section(s) a controller or handler belongs to. When several
 * keys are given, access is granted if ANY of them is allowed (OR).
 *
 * Class-level and method-level metadata are evaluated SEPARATELY and combined
 * with AND: a method-level `@RequireSection` refines, it does not replace, the
 * class-level one. So `@RequireSection("recipes.cost")` on a handler of a
 * `@RequireSection("recipes")` controller still requires `recipes` too.
 *
 * @example
 * @RequireSection("recipes")                // class
 * @RequireSection("recipes.cost")           // handler -> needs recipes AND recipes.cost
 */
export const RequireSection = (...keys: string[]) =>
  SetMetadata(SECTION_METADATA_KEY, keys);

/**
 * Handler-only: grants access if ANY of these keys is allowed, IGNORING the
 * class-level `@RequireSection`. Use for a handler that must stay reachable
 * when its controller's section is hidden — e.g. completing a prep task
 * (`production.tasks`) while the `production` section is off.
 *
 * @example
 * @RequireSection("production")                       // class
 * @RequireSectionAny("production", "production.tasks") // this handler: either
 */
export const RequireSectionAny = (...keys: string[]) =>
  SetMetadata(SECTION_ANY_METADATA_KEY, keys);

/**
 * Gates access by per-role, per-tenant section visibility. Place it AFTER
 * AuthGuard and TenantGuard so `req.user` and `req.tenantId` are resolved.
 *
 * - No @RequireSection metadata -> allow.
 * - ADMIN / OWNER / SUPERADMIN -> allow (config only governs USER/VIEWER).
 * - Otherwise: class keys (OR) AND handler keys (OR) must both pass.
 */
@Injectable()
export class SectionAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleAccess: RoleAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const anyKeys =
      this.reflector.get<string[]>(
        SECTION_ANY_METADATA_KEY,
        context.getHandler(),
      ) ?? [];
    const classKeys =
      this.reflector.get<string[]>(SECTION_METADATA_KEY, context.getClass()) ??
      [];
    const handlerKeys =
      this.reflector.get<string[]>(
        SECTION_METADATA_KEY,
        context.getHandler(),
      ) ?? [];

    if (
      anyKeys.length === 0 &&
      classKeys.length === 0 &&
      handlerKeys.length === 0
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role: string | undefined = request.user?.role;

    if (role && SECTION_BYPASS_ROLES.includes(role)) {
      return true;
    }

    const tenantId = request.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required");
    }

    // Per-request memoization: the same (role, key) can be checked repeatedly.
    const cache = new Map<string, Promise<boolean>>();
    const allowed = (key: string) => {
      let hit = cache.get(key);
      if (!hit) {
        hit = this.roleAccess.isSectionAllowed(tenantId, role, key);
        cache.set(key, hit);
      }
      return hit;
    };
    const anyAllowed = async (keys: string[]) => {
      for (const key of keys) {
        if (await allowed(key)) {
          return true;
        }
      }
      return false;
    };

    // @RequireSectionAny on the handler replaces the class gate entirely.
    if (anyKeys.length > 0) {
      if (await anyAllowed(anyKeys)) {
        return true;
      }
      throw new ForbiddenException({
        error: "SECTION_HIDDEN",
        section: anyKeys[0],
        message: `Section '${anyKeys[0]}' is not available for your role`,
      });
    }

    const classOk = classKeys.length === 0 || (await anyAllowed(classKeys));
    const handlerOk =
      handlerKeys.length === 0 || (await anyAllowed(handlerKeys));

    if (classOk && handlerOk) {
      return true;
    }

    const denied = handlerOk ? classKeys[0] : (handlerKeys[0] ?? classKeys[0]);
    throw new ForbiddenException({
      error: "SECTION_HIDDEN",
      section: denied,
      message: `Section '${denied}' is not available for your role`,
    });
  }
}
