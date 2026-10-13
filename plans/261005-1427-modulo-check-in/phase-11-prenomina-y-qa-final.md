---
phase: 11
title: "QA final (prenomina aplazada)"
status: in-progress
priority: P3
effort: "10-12h"
dependencies: [5, 8, 10]
---

# Phase 11: QA final de los tres módulos

## Overview

Revisión de calidad transversal de `check-in`, `turnos` y `rrhh`, guía de usuario y actualización de la documentación del proyecto. La prenómina se aplazó junto con las nóminas por decisión del usuario (2026-10-05); el nombre del fichero se conserva por la CLI de planes.

## Requirements

- Funcional: ninguna funcionalidad nueva.
- No funcional: los tres módulos verificados de extremo a extremo, en dispositivos reales, con backup/restore comprobado.

## Related Code Files

- Create: pruebas e2e en `frontend/` (Playwright) y `backend/` (jest e2e contra `chefchek_test`)
- Create: `docs/check-in-user-guide.md`
- Modify: `docs/project-changelog.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/USERGUIDE.md`

## Implementation Steps

1. e2e completo: configuración y validación de textos → alta de empleado → fichajes (personal, kiosco, sin conexión) → turno partido → corrección → hoja aprobada → informe PDF/XLSX.
2. e2e de turnos: ausencia aprobada → planificación → publicación → plan vs real.
3. e2e de portal y documentos con dos empleados (aislamiento).
4. Aislamiento multi-tenant en los tres módulos.
5. Activar/desactivar módulos y secciones por rol.
6. Backup y restore de tenant con todas las tablas nuevas (incluidas las append-only).
7. Revisión de seguridad: PIN de kiosco, enlace de inspección, adjuntos privados, permisos de Configuración.
8. Accesibilidad y modo oscuro de las pantallas nuevas.
9. Prueba en dispositivos reales: iPhone, Android, tablet de cocina como kiosco.
10. Guía de usuario (empleado, administrador, "qué hacer ante una inspección") y actualización de docs.

## Success Criteria

- [x] Batería e2e y jest en verde en local (backend); la compilación de producción la valida el CI de cada PR
- [x] Backup/restore verificado con las tablas de los tres módulos (e2e `check-in-backup-roundtrip`)
- [ ] Revisión de seguridad independiente (hecha solo la propia de cada fase: aislamiento, permisos y adjuntos privados con e2e)
- [ ] Probado en iPhone, Android y tablet (pendiente: lo hace el usuario)
- [x] Guía de usuario (`docs/check-in-user-guide.md`) y changelog actualizados

## Risk Assessment

- Deriva de reglas de Backup tras 10 fases → verificación explícita en el paso 6.
- Defectos tardíos en el modo sin conexión → cada fase ya trae sus pruebas; aquí solo se confirma el conjunto.

## Estado (2026-10-13)

- **Hecho**: e2e por fase (check-in, turnos, plan frente a real, Mi espacio, documentos, backup), guía de usuario y changelog. Navegador en local, escritorio y móvil a 390 px, modo oscuro.
- **Sin hacer**: pruebas Playwright en `frontend/`; modo claro y accesibilidad con lector; dispositivos reales; fichaje sin conexión con contraseña (el service worker solo existe en la compilación de producción).
- **Observación**: activar un módulo no comprueba que su dependencia esté activa (solo se impide desactivar la dependencia). Vale para todos los módulos, no solo estos; no se ha cambiado.
- **Pendiente de fases anteriores**: las ausencias aprobadas no figuran en el registro de jornada ni en los informes; al publicar una semana no se avisa a los afectados; el planificador solo tiene vista de semana.
