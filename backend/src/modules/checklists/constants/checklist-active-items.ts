/**
 * Ítems vigentes de una plantilla (sin los retirados del Plan que se conservan
 * solo porque tienen marcas), en su orden. Usar en todo `include` que
 * represente el Plan actual o genere hojas nuevas.
 */
export const ACTIVE_CHECKLIST_ITEMS = {
  where: { removedAt: null },
  orderBy: { position: "asc" as const },
};
