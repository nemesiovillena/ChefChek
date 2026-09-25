---
phase: 10
title: "Docs y cierre"
status: pending
priority: P2
effort: "S"
dependencies: [5]
---

# Phase 10: Docs y cierre

## Overview

Documentar lo construido, dejar reproducible el despliegue y activar el módulo en el tenant piloto (Warynessy) de forma controlada. Se ejecuta tras el MVP (fase 5) y se repite de forma incremental al cerrar cada fase posterior.

## Requirements

- Docs actualizadas solo donde cambió comportamiento/arquitectura (regla del usuario: sin ruido de changelog interno).
- Despliegue verificable sin pérdida de datos.

## Related Code Files

- Create: `docs/sicted-system-architecture.md` (modelo, inalterabilidad, triggers y escape, cron, roles, exportables, límites).
- Modify: `docs/project-changelog.md`, `docs/codebase-summary.md`, `docs/system-architecture.md` (referencia), `docs/user-guides.md` o `docs/USERGUIDE.md` (guía de uso del registro diario y del pack de auditoría), `docs/backup-recovery.md` (exclusión de `sicted_*` en restore y adjuntos fuera del JSON), `docs/deployment-guide.md` (migración con trigger, cron).
- Leer antes de tocar cualquier doc existente; verificar fechas, enlaces y afirmaciones contra el código.

## Implementation Steps

1. Redactar `docs/sicted-system-architecture.md` desde el código final (no desde este plan).
2. Guía de usuario: cómo montar el Plan, rellenar "Hoy", validar, y qué entregar al evaluador; **incluir la advertencia** de que SICTED lo concede el evaluador oficial y Chefchek aporta evidencias.
3. Despliegue: PR a `develop` por fase; release = PR `develop → main` (no push directo). El contenedor aplica migraciones al arrancar → revisar el SQL de triggers en el PR de release. Comprobar `binaryTargets` de Prisma (openssl) si la imagen cambia.
4. Activación en piloto: activar `sicted` solo para el tenant de Warynessy; cargar plantillas de ejemplo; **completar productos/dosis reales con la cocina** antes de usarlo como evidencia.
5. Verificación post-deploy (sondeo Dokploy con `project-all` o comprobación funcional; el fingerprint de chunks de la home **no** sirve para detectar el build nuevo).
6. Guardar en memoria del proyecto (engram/`memory/`): decisión SICTED≠APPCC, trigger con escape, cuenta compartida, y el bug ajeno del frontend APPCC.
7. Retro breve: qué prácticas del manual quedan sin cobertura software.

## Success Criteria

- [ ] Docs coherentes con el código y sin enlaces rotos.
- [ ] Migración aplicada en prod sin errores; módulo off para el resto de tenants.
- [ ] Piloto con al menos una semana de registros reales validados.
- [ ] Backup+restore de prueba en `chefchek_test` OK con datos SICTED.

## Risk Assessment

- *Piloto con plantillas de ejemplo tomadas como reales*: checklist de puesta en marcha con firma del responsable.
- *Rollback*: desactivar módulo (los datos permanecen); la migración es aditiva, no se revierte en prod una vez hay evidencia (regla de cero pérdida de datos).
