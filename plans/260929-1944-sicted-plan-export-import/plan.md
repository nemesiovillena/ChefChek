# Exportar / importar plantillas del Plan SICTED entre tenants

Status: hecho (verificado en dev, PR a develop) · Rama: feat/sicted-exportar-importar-plan

## Objetivo
Llevar plantillas (hojas del Plan + ítems) de un tenant a otro (y de dev a prod) con un archivo JSON.

## Decisiones
- Export en cliente (datos ya cargados en El Plan); exporta las plantillas visibles (respeta el buscador).
- Archivo: `{ format: "chefchek-sicted-plan", version: 1, exportedAt, templates: CreateChecklistTemplateDto[] }` sin ids/tenant/autor/marcas.
- Import: `POST /api/v1/sicted/checklists/templates/import` (ADMIN/OWNER), mismo DTO/validación que el alta, 1 transacción, omite nombres ya existentes (sin distinguir mayúsculas/tildes) y duplicados dentro del archivo. Devuelve `{created, skipped}`.
- Sin "crear copia", sin equipos/mantenimiento (YAGNI; se puede añadir al mismo formato).

## Archivos
- backend: checklist-template.dto.ts (ImportChecklistTemplatesDto), checklist-template.service.ts (importMany), sicted-checklist.controller.ts, spec nuevo.
- frontend: lib/sicted-plan-file.ts (nuevo), hooks/use-sicted.ts, sicted/plan/page.tsx, components/sicted-plan-import-dialog.tsx (nuevo), sicted-template-editor.tsx (reusa templateToInput).

## Validación
Unit test service; lint+tsc; E2E manual en dev (exportar sicted-demo → importar en otro tenant).
