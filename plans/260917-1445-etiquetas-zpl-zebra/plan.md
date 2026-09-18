# Etiquetas: generar ZPL nativo para Zebra ZD220D

Status: en progreso
Branch: develop

## Decisiones (confirmadas por el usuario)

1. Conexión impresora: **USB + Zebra Browser Print** (SDK oficial de Zebra, corre local en el PC que imprime; el frontend le manda el ZPL vía su API JS a localhost).
2. **Sustituye por completo** el PDF térmico actual — no conviven. Las hojas A4 (impresora láser) siguen en PDF sin cambios.
3. Ajuste de texto: **`^FB` nativo de ZPL** (bloque de campo con nº de líneas fijo). Sin wrap manual estilo pdfkit; si no cabe, ZPL corta sin `…`.
4. Tamaño de etiqueta validado: 60×40 mm → 480×320 dots @203dpi, margen 2.5mm (ya validado visualmente en PDF antes de portar a ZPL).
5. Todo lo configurable (medidas, dpi) debe vivir en Ajustes → Etiquetas, igual que hoy con los perfiles térmicos, por si cambia la impresora o el tamaño de rollo.

## Fases

- [x] Fase 1 — Backend: `FoodLabelZplService` (genera ZPL puro, sin hardware), endpoint `GET /labels/:id/zpl`, `dpi` configurable por perfil, tests.
- [x] Fase 2 — Retirado el PDF térmico (dead code tras la sustitución): `resolveSpec` (PDF) ahora solo acepta A4 y lanza 400 si le llega `thermal:*`; nuevo `resolveThermalProfile` para ZPL. Reglas de negocio compartidas (`food-label-print-format.util.ts`) para que PDF y ZPL no diverjan.
- [x] Fase 3 — Frontend: `src/lib/zebra-browser-print.ts` (wrapper del SDK de Zebra Browser Print: detección de dispositivos, impresora por defecto, envío, `sendThenRead`), `printLabel`/`printLabelZpl` en `use-food-labels.ts` (sustituye `openLabelPdf` en los dos sitios que imprimen), widget `ZebraPrinterStatus` en Ajustes → Etiquetas (comprobar conexión, listar impresoras, elegir preferida — persistida en `localStorage`, etiqueta de prueba). **Falta la prueba física real** (hardware + SDK instalado en el PC del usuario) — no se puede hacer end-to-end desde aquí.
- [x] QR recalculado con el nº de módulos REAL (vía `QRCode.create()`, mismo algoritmo ISO/IEC 18004 que usa el firmware Zebra) en vez de una suposición fija.
- [x] `computeZplLayout()` expuesto como plantilla de calibración (posiciones/tamaños con nombre por campo) para ajustar solo constantes tras la prueba física, sin tocar la lógica.

## Pendiente para cerrar del todo (requiere al usuario)

1. ~~Descargar el SDK~~ — resuelto: se carga desde jsDelivr (`zebra-browser-print@1.0.1`, verificado que es el SDK oficial de Zebra republicado, misma API). Sin pasos de instalación en el repo.
2. Instalar la app de escritorio "Zebra Browser Print" en el PC que imprime (Windows/macOS) y conectar la Zebra por USB — el usuario la instalará más adelante.
3. Probar desde Ajustes → Etiquetas → "Comprobar" / "Imprimir prueba".
4. Con la impresora real: verificar tamaño físico del QR, tamaños de fuente/posiciones (`computeZplLayout` en `food-label-zpl.service.ts`), densidad/oscuridad y calibración del rollo. Ajustar solo las constantes `*_MM` de ese archivo si algo no cuadra.

## Notas técnicas

- QR: magnificación = `ancho_objetivo_mm(15) en dots / nº_módulos_real`. El nº de módulos ya no se asume — se calcula con la librería `qrcode` (misma que ya usaba el PDF) para el contenido exacto y nivel de corrección M, así coincide con lo que la Zebra codificará.
- Tamaños de fuente/posiciones en `food-label-zpl.service.ts` (constantes `*_MM`) son una primera estimación, no verificados en papel real.
- Perfil por defecto pasó de 57×40 a 60×40mm (decisión de una sesión anterior), con `dpi:203` explícito, configurable en Ajustes.
- Arquitectura Fase 3: generador ZPL (backend) y transporte (Browser Print, frontend) totalmente desacoplados — cambiar de transporte el día de mañana no toca el generador.

## Reports

Ninguno todavía.
