---
phase: 10
title: "Documentacion laboral"
status: completed
priority: P3
effort: "12-14h"
dependencies: [9]
---

# Phase 10: Documentación laboral

## Overview

Gestión de contratos, justificantes y otros documentos laborales por empleado, con almacenamiento privado, acuse de lectura y avisos de caducidad. **Sin nóminas** (aplazado por decisión del usuario).

## Requirements

- Funcional: subir documentos por empleado y categoría; el empleado los consulta y da acuse; el empleado sube justificantes; caducidad opcional con aviso; envío del mismo documento a varios empleados (p. ej. protocolo interno).
- No funcional: acceso solo para gerencia y el titular; descarga autenticada; tipos de archivo restringidos (PDF, imágenes incluida HEIC).

## Architecture

- `EmployeeDocument`: `employeeId`, `category` (`CONTRATO|JUSTIFICANTE|FORMACION|PRL|OTRO`), `title`, `fileKey`, `mimeType`, `sizeBytes`, `uploadedByUserId`, `uploadedByEmployee`, `requiresAck`, `expiresAt?`, `deletedAt`.
- `DocumentAck` (append-only): `documentId`, `employeeId`, `ackAt`, `ipAddress?`, `userAgent?`.
- Almacenamiento con `store-private-attachment.util.ts` (Bunny privado); descarga vía endpoint que comprueba permiso y emite el fichero.
- No se reutiliza el modelo `Document` existente (es de fichas técnicas/OCR, con otro ciclo de vida).
- Acuse = registro de lectura con fecha; no es firma electrónica cualificada (se indica en la interfaz).
- Cron diario: documentos que caducan en 30/7 días → `Alert` a gerencia.
- La categoría `NOMINA` queda reservada para el futuro; no se implementa.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `rrhh.module.ts`, reglas de Backup y Papelera
- Create: migración `<ts>_employee_documents` (+ trigger en `document_acks`)
- Create: `backend/src/modules/rrhh/documents.controller.ts`, `services/employee-documents.service.ts`, `services/document-expiry.cron.ts`, `dto/` + specs
- Create: `frontend/src/app/dashboard/rrhh/documentos/`, `frontend/src/app/dashboard/mi-espacio/documentos/`, componentes `document-upload-dialog.tsx`, `document-list.tsx`, `ack-button.tsx`

## Implementation Steps

1. Modelos y migración.
2. Servicio de subida (borrar `Content-Type` en FormData en el apiClient; allowlist de mimetypes con jpg y HEIC).
3. Descarga autenticada con comprobación de titularidad; tests de acceso cruzado.
4. Acuse y listado de pendientes de acuse para gerencia.
5. Envío a varios empleados (un registro por empleado, mismo fichero).
6. Cron de caducidades.
7. Interfaces de gerencia y de empleado.
8. Vincular justificantes de ausencia (Fase 6) para que aparezcan también aquí.

## Success Criteria

- [x] Subir, consultar y descargar un documento con permisos correctos (e2e + navegador)
- [x] Un empleado no puede descargar documentos de otro (e2e)
- [x] Acuse registrado e inmutable (e2e: el trigger rechaza UPDATE y DELETE)
- [x] Caducidad señalada: "Caduca pronto" (30 días) y "Caducado" (e2e + navegador)
- [x] El tipo HEIC se acepta en la subida (e2e); falta probar desde un iPhone real

## Risk Assessment

- URL de fichero expuesta → nunca URL pública; siempre endpoint autenticado.
- Confusión acuse/firma legal → texto claro en la interfaz y en la guía.
- Retención de documentos de exempleados → política a definir con asesor; sin borrado automático.

## Desviaciones (2026-10-13)

- **Sin cron ni `Alert` de caducidad**: la campana es común a todo el tenant y revelaría documentos de una persona a toda la plantilla. La caducidad se ve en "Documentos del equipo" (distintivos y contador de pendientes) y en "Mi espacio".
- **`EmployeeDocumentAck` sin claves foráneas**, con el título y el nombre copiados, como el resto de tablas de evidencia; añadida a `EVIDENCE_TABLES` del backup.
- **Un documento con acuse no se puede retirar.** Retirar es un borrado lógico (`deletedAt`); no entra en la Papelera.
- **Varias personas, un fichero**: un registro por persona con la misma `fileKey`.
- **Justificantes sin vínculo a una ausencia concreta**: el empleado los sube en "Mi espacio → Documentos" con un título libre.
- Añadidos `fileName`, `uploadedByName` y `updatedAt` al modelo.
