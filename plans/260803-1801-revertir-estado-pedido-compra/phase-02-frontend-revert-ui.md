# Fase 2: UI para revertir estado (botón + motivo + hook)

## Contexto
- Ficha de pedido: `frontend/src/app/dashboard/compras/pedidos/[id]/page.tsx` — `STATUS_ACTIONS` (líneas 42-64), `handleTransition` (179-193), usa `useConfirm()` (línea 111, import de `@/contexts/confirm.context`).
- `useConfirm`/`ConfirmDialog` no tiene campo de texto dedicado, pero `ConfirmOptions.children` sí se renderiza dentro del diálogo (`frontend/src/components/ui/confirm-dialog.tsx:85`) — usar ese slot para un `<textarea>`/`Input` de motivo, sin tocar el componente compartido.
- Rol de usuario disponible en `useAuth().user.role` (`frontend/src/services/auth.service.ts:16`, expuesto vía `AuthContextType.user` en `frontend/src/contexts/auth.context.tsx`).
- Hook a replicar: `useTransitionPurchaseOrder` en `frontend/src/hooks/use-purchase-orders.ts:172-183` (usa `useMutation`, `BASE_URL` línea ~106, `useInvalidateOrders()` líneas 134-137, `apiClient.patch`).

## Requisitos
1. Nuevo hook `useRevertPurchaseOrderStatus` en `use-purchase-orders.ts`, mismo patrón que `useTransitionPurchaseOrder`:
   - `mutationFn: ({ id, reason }) => apiClient.patch(\`${BASE_URL}/${id}/revertir\`, { reason })`
   - `onSuccess: invalidate` (misma invalidación que el resto de mutaciones del módulo).
2. En `OrderDetail` (pedido detail page):
   - Mostrar botón "Deshacer (volver a Borrador)" solo si `['ENVIADO','RECIBIDO_PARCIAL','RECIBIDO','CANCELADO'].includes(order.status)` **y** el rol del usuario autenticado es `ADMIN`/`OWNER`/`SUPERADMIN` (usar `useAuth()`).
   - Al pulsar: abrir `confirm()` con `variant: 'destructive'`, `title`, `description` explicando que esto es una corrección administrativa, y `children` con un textarea controlado (state local `reason`) — deshabilitar el botón de confirmar del diálogo si `reason.trim().length < 10` (si `ConfirmOptions` no soporta deshabilitar el confirm dinámicamente, validar dentro del `onConfirm`/antes de llamar la mutación y no cerrar si es inválido — revisar la firma real de `useConfirm` al implementar).
   - Al confirmar: `revertMut.mutateAsync({ id: order.id, reason })`, manejar error 409 mostrando el mensaje del backend tal cual (`notifyError`, ya existe el patrón en el archivo).
3. Icono: reutilizar `ArrowLeft` (ya importado) o `Undo2` de `lucide-react` si se prefiere distinguirlo visualmente del resto de acciones de `STATUS_ACTIONS` (este botón vive fuera de esa tabla, al ser condicional por rol).

## Archivos a modificar
- `frontend/src/hooks/use-purchase-orders.ts` — nuevo hook.
- `frontend/src/app/dashboard/compras/pedidos/[id]/page.tsx` — botón + diálogo + wiring.

## Verificación end-to-end
1. Levantar backend (`bun run start:dev` o equivalente) y frontend (`bun run dev`) en local.
2. Con usuario ADMIN: crear pedido de prueba, marcarlo `ENVIADO` y `RECIBIDO` manualmente, confirmar que aparece "Deshacer", que pide motivo (rechaza motivo corto/vacío), y que tras confirmar el pedido queda en `BORRADOR` editable — revisar historial de eventos en la propia ficha (sección de eventos, `EVENT_LABELS`).
3. Con usuario USER: confirmar que el botón no aparece y que un PATCH directo a `/revertir` devuelve 403.
4. Simular un pedido con recepción real conciliada (o insertar `receivedQuantity` de prueba) y confirmar que el backend bloquea con 409 y el frontend muestra el mensaje de error sin romper la página.
5. `bun run build` (frontend) y `bun run test` (backend) antes de dar por cerrada la fase.

## Riesgos / rollback
- Riesgo principal: exponer el botón a un rol equivocado si `useAuth().user.role` no está poblado a tiempo (hidratación) — verificar que no aparezca brevemente para USER durante el loading (mismo cuidado que `frontend-authcontext-hydration-no-flash` ya documentado en memoria del proyecto).
- Rollback: cambios acotados a 2 archivos frontend, revertir commit sin efectos colaterales (no toca backend ni datos).
