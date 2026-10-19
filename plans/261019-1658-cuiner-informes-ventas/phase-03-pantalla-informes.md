# Fase 3 — Pantalla de informes

## Archivos
- nueva ruta `frontend/src/app/dashboard/cuiner/informes/page.tsx` o pestaña «Informes» en Cuiner (solo ADMIN/OWNER/SUPERADMIN)
- hooks en `frontend/src/hooks/use-cuiner.ts`; tipos en `frontend/src/lib/cuiner-types.ts`

## UI
- Filtros: periodo rápido (hoy, esta semana, este mes, este año, rango) + agrupar por (día/semana/mes/año) + nivel de familia.
- Tabla: periodo × familia con unidades, base, total IVA, %; filas de familia desplegables a subfamilias y platos.
- Selector de salida: Pantalla / Excel / CSV / PDF (descarga desde el servidor).
- Estado del histórico: «Importando histórico: hasta dd/mm/aaaa» mientras no acabe.
- Móvil: tabla apilada (max-md + data-label); dark mode con tokens.

## Validación
- Navegador: un día concreto cuadra con el cierre de caja de Cuiner.
- Descargas abren bien en Excel/Numbers y PDF.

## Resultado (2026-10-19)
- Pestaña «Informes» en Cuiner, solo ADMIN/OWNER/SUPERADMIN.
- Filtros: periodo rápido (hoy…año pasado) o fechas a mano, agrupar, detalle (familia/subfamilia/sección/plato), salida (Pantalla/Excel/CSV/PDF) + «Generar»/«Descargar». En pantalla, botones Excel/CSV/PDF del informe mostrado.
- Pulsar familia baja un nivel; «Sin familia» baja directo a platos; migas para subir.
- Avisos: histórico en curso (desde fecha) y líneas sin importe.
- Móvil: filas como tarjetas (data-label). Probado en navegador (escritorio y 400 px).
- Descarga de archivos no pulsada en navegador (guardaría en el equipo del usuario): cubierta por test del controlador (tipo, nombre, cabecera del archivo).
