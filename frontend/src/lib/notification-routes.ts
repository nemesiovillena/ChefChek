/**
 * Resuelve a qué ruta navegar al hacer click en una notificación de la
 * campana, a partir de la entidad de origen (`Alert.entityType`/`entityId`
 * en backend). La URL se calcula aquí, no se guarda en BD, para no acoplar
 * filas de BD a la estructura de rutas de Next.js.
 *
 * PRODUCTION_ORDER queda fuera a propósito: no existe página de detalle hoy
 * (módulo de Producción en rework). Un tipo sin entrada aquí simplemente no
 * navega (comportamiento actual de la campana).
 */
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  PRODUCT: (id) => `/dashboard/articulos?productId=${id}&tab=historial-precios`,
  PURCHASE_ORDER: (id) => `/dashboard/compras/pedidos/${id}`,
};

export function resolveNotificationRoute(
  entityType?: string,
  entityId?: string,
): string | null {
  if (!entityType || !entityId) {
    return null;
  }
  return ENTITY_ROUTES[entityType]?.(entityId) ?? null;
}
