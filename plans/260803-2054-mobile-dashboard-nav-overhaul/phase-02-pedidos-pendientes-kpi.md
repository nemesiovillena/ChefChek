# Fase 2 — Reconectar KPI "Pedidos Pendientes"

## Archivos
- `backend/src/modules/dashboard/dashboard.service.ts` (~línea 153)
- `frontend/src/app/dashboard/page.tsx` (~línea 127-142)

## Pasos
1. Backend: sustituir `this.prisma.order.count(...)` (modelo legacy `Order`)
   por `this.prisma.purchaseOrder.count({ where: { tenantId, status: { in:
   ['ENVIADO', 'RECIBIDO_PARCIAL'] } } })`.
2. Frontend: la card ya lee `kpis.pendingOrders` — solo añadir
   `onClick={() => router.push('/dashboard/compras')}` + cursor-pointer
   (la pestaña por defecto de Compras ya es "Pedidos").
3. Quitar el badge simulado `+2 RUSH` (dato inventado, no viene del backend).

## Validación
- Con pedidos reales en ENVIADO/RECIBIDO_PARCIAL en BD, el número de la
  card coincide con el listado de Compras > Pedidos.
