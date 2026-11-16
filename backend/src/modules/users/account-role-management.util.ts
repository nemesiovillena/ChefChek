import { ForbiddenException } from "@nestjs/common";

/**
 * Cuentas que puede crear, editar o borrar el rol GESTION (oficina): gestiona
 * Personal pero nunca a la gerencia ni puede dar un rol de gerencia.
 */
const GESTION_MANAGEABLE_ROLES = new Set([
  "USER",
  "USER_CUINER",
  "GESTION",
  "VIEWER",
]);

/** Lanza 403 si quien actúa no puede gestionar una cuenta con ese rol. */
export function assertActorCanManageRole(
  actorRole: string | undefined,
  targetRole: string | undefined,
): void {
  if (actorRole !== "GESTION" || !targetRole) {
    return;
  }
  if (!GESTION_MANAGEABLE_ROLES.has(targetRole)) {
    throw new ForbiddenException(
      "El rol Gestión no puede gestionar cuentas de administración.",
    );
  }
}
