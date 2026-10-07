---
phase: 11
title: "QA final (prenomina aplazada)"
status: pending
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

- [ ] Batería e2e y jest en verde; builds de backend y frontend sin errores
- [ ] Backup/restore verificado
- [ ] Sin hallazgos de seguridad abiertos de severidad alta
- [ ] Probado en iPhone, Android y tablet
- [ ] Guía de usuario publicada y docs actualizadas

## Risk Assessment

- Deriva de reglas de Backup tras 10 fases → verificación explícita en el paso 6.
- Defectos tardíos en el modo sin conexión → cada fase ya trae sus pruebas; aquí solo se confirma el conjunto.
