---
phase: 10
title: "Docs y cierre"
status: in-progress
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

- [x] Docs coherentes con el código y sin enlaces rotos. — `docs/sicted-system-architecture.md` (nuevo, redactado desde el código final, no desde este plan) + entrada en `docs/codebase-summary.md`.
- [ ] Migración aplicada en prod sin errores; módulo off para el resto de tenants. — **pendiente de decisión del usuario**: requiere un release PR `develop→main`, no se hace sin confirmación explícita (regla del proyecto: nunca push directo a `main`, deploy = PR release).
- [ ] Piloto con al menos una semana de registros reales validados. — **no completable en esta sesión** (requiere una semana de uso real por el personal de Warynessy tras la activación).
- [ ] Backup+restore de prueba en `chefchek_test` OK con datos SICTED. — cubierto de forma indirecta: el escape `chefchek.allow_evidence_purge` se ejercita en todos los tests e2e de limpieza de fixtures (fases 1-9); no se ha corrido un backup/restore JSON completo dedicado con datos SICTED reales como prueba aparte.

Guardado en memoria del proyecto (paso 6 del plan): `sicted-manual-source-correction-appcc-confusion` y `sicted-inalterabilidad-triggers-postgres` (decisión SICTED≠APPCC, patrón de triggers con escape, corrección crítica de fuente del manual).

## Risk Assessment

- *Piloto con plantillas de ejemplo tomadas como reales*: checklist de puesta en marcha con firma del responsable.
- *Rollback*: desactivar módulo (los datos permanecen); la migración es aditiva, no se revierte en prod una vez hay evidencia (regla de cero pérdida de datos).

## Retro (paso 7): qué queda sin cobertura software

De las 144 prácticas del catálogo real (BP1-BP6), el software cubre directamente (registro, evidencia o motor de checklist) los bloques de limpieza/mantenimiento (BP5/BP6), proveedores/recepción/FIFO (BP4), personas/formación/protocolos (BP1), cliente/quejas/satisfacción (BP2), y el propio ciclo de autoevaluación/plan de mejora/objetivos/eventos/documentos legales (Dirección). Quedan explícitamente **fuera del software**, como el plan siempre dejó claro:

- Prácticas puramente documentales/procedimentales sin dato que registrar (protocolos de bienvenida, gestión de reservas/lista de espera, servicio de mesa, cobro) — Chefchek no es TPV ni sistema de reservas; se cubren con protocolo narrativo en la Wiki + acuse de lectura (fase 7), no con un formulario de datos.
- Ventas y marketing (BP3): mayormente criterios de precios/cartas en varios idiomas/promoción — fuera del dominio de datos de Chefchek.
- Integración con la plataforma oficial SICTED: la autoevaluación de este módulo es apoyo interno; no hay API pública verificada para conectar con la evaluación real.
- El "motor de cobertura automática" (marcar una práctica como "con evidencia" sin acción manual, cruzando el catálogo real con los módulos operativos) no se construyó — ver "Límites conocidos" en `docs/sicted-system-architecture.md`.
