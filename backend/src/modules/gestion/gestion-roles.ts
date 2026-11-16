/** Ven ventas y facturación (módulo Gestión y asistente): gerencia y oficina. */
export const GESTION_ROLES = [
  "ADMIN",
  "OWNER",
  "SUPERADMIN",
  "GESTION",
] as const;

export const canSeeSales = (role: string | undefined): boolean =>
  (GESTION_ROLES as readonly string[]).includes(role ?? "");
