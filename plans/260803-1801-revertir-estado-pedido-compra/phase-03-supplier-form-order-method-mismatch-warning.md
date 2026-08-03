# Fase 3: aviso si hay contacto guardado pero el canal no está marcado

## Contexto (incidente real)
Proveedor "Mar Menor" en prod tiene `whatsapp: "722835087"` guardado pero `orderMethods: ["WEB"]` (sin `WHATSAPP`). El diálogo de envío (`send-order-dialog.tsx:132`) solo muestra el bloque de un canal si está en `orderMethods` — ignora si el dato de contacto existe. Resultado: el usuario solo veía "Marcar enviado" (canal WEB, que significa "hice el pedido en la web del proveedor", no un envío real) y no tenía forma de avisar por WhatsApp desde la app, aunque el número estaba guardado.

No es un bug de lógica (el filtro es correcto y consistente backend/frontend), es una desincronización de datos fácil de cometer: `phone`/`whatsapp`/`email` son inputs de texto independientes de los checkboxes de `orderMethods` (`frontend/src/app/dashboard/articulos/components/supplier-form.tsx:68-76, 123-132, 190-211`) — nada avisa si rellenas el dato y olvidas marcar la casilla.

## Requisito
En `SupplierForm` (`frontend/src/app/dashboard/articulos/components/supplier-form.tsx`), mostrar un aviso inline (no bloqueante, mismo estilo que otros banners advisory del repo, ej. aviso de duplicados en artículos) cuando:
- `whatsapp` tiene valor no vacío **y** `'WHATSAPP'` no está en `selectedMethods`, y/o
- `phone` tiene valor no vacío **y** `'PHONE'` no está en `selectedMethods`.

Mensaje sugerido: "Tienes un WhatsApp/teléfono guardado pero no está marcado como método de pedido — el proveedor no verá esta opción al enviar pedidos."

## Implementación
- Usar `watch` de `react-hook-form` (no está importado actualmente, solo `register`/`handleSubmit`/`formState`/`setValue` — línea 1-2, 22) para leer `whatsapp`/`phone` en vivo: `const whatsappValue = watch('whatsapp'); const phoneValue = watch('phone');`.
- Renderizar el aviso justo debajo del bloque de checkboxes (después de línea 210, dentro del mismo `<div>` de "Métodos de pedido").
- No bloquear el submit — es solo informativo, igual que el resto de advisories del proyecto (no usar `alert()`/`confirm()` nativos, seguir patrón M3 existente de banners inline).

## Archivos a modificar
- `frontend/src/app/dashboard/articulos/components/supplier-form.tsx`

## Verificación
1. Editar un proveedor: rellenar WhatsApp sin marcar la casilla → aparece el aviso.
2. Marcar la casilla WhatsApp → el aviso desaparece.
3. Guardar sin marcar la casilla → debe guardar igual (no bloqueante), solo advierte.
4. Aplicar el fix real al proveedor "Mar Menor" en producción (marcar WhatsApp) para que PED-0007 y futuros pedidos a ese proveedor puedan enviarse por WhatsApp.

## Riesgos / rollback
Cambio aislado a un componente de formulario, sin tocar backend ni datos. Revertir el commit basta.
