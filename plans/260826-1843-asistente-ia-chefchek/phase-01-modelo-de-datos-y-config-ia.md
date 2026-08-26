---
phase: 1
title: Modelo de datos y config IA
status: completed
priority: P1
dependencies: []
---

# Phase 1: Modelo de datos y config IA

## Overview

Base de datos y configuración por tenant para el asistente: modelos Prisma para persistir conversaciones/mensajes, y un servicio de configuración (proveedor + modelo + API key cifrada) independiente de `ocr-config`, siguiendo el mismo patrón (`Configuration` + AES-256-GCM).

## Requirements

- Funcional: el tenant puede elegir proveedor (`openai` | `gemini` | `anthropic`), modelo (texto libre, p.ej. `gpt-4o-mini`, `gemini-2.0-flash`, `claude-3-5-haiku`) y guardar su API key; la key nunca vuelve al frontend, solo un flag `hasApiKey`.
- Funcional: cada mensaje de una conversación se persiste (rol `user`/`assistant`/`tool`, contenido, y qué tools se llamaron) para que el historial sobreviva a recargas de página.
- No-funcional: la API key se cifra con `encryptSecret`/`decryptSecret` de `common/utils/encryption.util.ts` usando un salt propio `"chefchek-assistant"` (dominios de cifrado separados, igual que SMTP/OCR).
- No-funcional: todo modelo nuevo lleva `tenantId` con índice, y las conversaciones llevan `userId` (un usuario no debe ver el historial de otro dentro del mismo tenant).

## Architecture

Dos modelos nuevos en `schema.prisma`, junto a los existentes `Configuration`, `Tenant`, `User`:

```prisma
model AssistantConversation {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant   Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user     User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AssistantMessage[]

  @@index([tenantId, userId])
  @@map("assistant_conversations")
}

model AssistantMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant" | "tool"
  content        String   @db.Text
  toolCalls      Json?    // [{name, params, result}] para depuración/auditoría
  createdAt      DateTime @default(now())

  conversation AssistantConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("assistant_messages")
}
```

Añadir las relaciones inversas `assistantConversations AssistantConversation[]` en `Tenant` y `User`.

Config de proveedor: reutiliza la tabla `Configuration` (no un modelo nuevo), igual que `ocr-config.service.ts` pero con su propia categoría/keys para no pisar la config de OCR:

- `category`: `"ASSISTANT"`
- `assistant.provider` → `"openai" | "gemini" | "anthropic"`
- `assistant.model` → string libre
- `assistant.api_key` → cifrado con salt `"chefchek-assistant"`

## Related Code Files

- Modify: `backend/prisma/schema.prisma` (nuevos modelos + relaciones inversas en `Tenant`/`User`)
- Create: `backend/prisma/migrations/<timestamp>_add_assistant_conversations/migration.sql` (ver nota de proceso abajo)
- Create: `backend/src/modules/ai-assistant/config/ai-assistant-config.service.ts`
- Create: `backend/src/modules/ai-assistant/config/ai-assistant-config.controller.ts`
- Create: `backend/src/modules/ai-assistant/config/dto/ai-assistant-config.dto.ts`
- Create: `backend/src/modules/ai-assistant/config/ai-assistant-config.service.spec.ts`
- Reference (patrón a copiar): `backend/src/modules/ocr-config/ocr-config.service.ts`, `backend/src/common/utils/encryption.util.ts`

## Implementation Steps

1. Añadir `AssistantConversation` y `AssistantMessage` a `schema.prisma`, más las relaciones inversas en `Tenant` y `User`.
2. Generar la migración con `prisma migrate diff` + `migration.sql` manual + `prisma migrate deploy` (el entorno no tiene TTY para `migrate dev` — ver memoria `prisma-migrate-dev-non-interactive-workaround`), o `prisma migrate dev` si se ejecuta desde un shell interactivo local.
3. Crear `AiAssistantConfigService` calcado de `OcrConfigService`: `getPublicConfig(tenantId)` (provider, model, hasApiKey — nunca la key en claro), `saveConfig(tenantId, dto, userId)` (si `apiKey` viene vacío/omitido, conserva el guardado), `resolveForRequest(tenantId)` (uso interno, sí descifra, para que lo consuma el orquestador de fase 3).
4. DTO con `class-validator`: `provider` enum `openai|gemini|anthropic`, `model` string opcional, `apiKey` string opcional.
5. Controller con `GET /ai-assistant/config` (público, sin key) y `PUT /ai-assistant/config` (guardar), protegidos por `AuthGuard` + rol admin (mismo criterio que `ocr-config.controller.ts`).
6. Módulo `AiAssistantConfigModule` importando `PrismaModule`; se registrará en `AiAssistantModule` (fase 3), no directamente en `app.module.ts` todavía.
7. Tests: `ai-assistant-config.service.spec.ts` cubriendo guardar/leer, key vacía conserva la anterior, y que `getPublicConfig` nunca expone la key descifrada.

## Success Criteria

- [ ] `bunx prisma validate` pasa con los modelos nuevos.
- [ ] Migración aplicada sin romper datos existentes (`prisma migrate status` limpio).
- [ ] `AiAssistantConfigService.getPublicConfig` nunca devuelve `apiKey` en claro, solo `hasApiKey: boolean`.
- [ ] Guardar con `apiKey: ""` u omitido conserva la key previamente guardada (test específico, mismo comportamiento que SMTP/OCR).
- [ ] Tests de `ai-assistant-config.service.spec.ts` en verde vía `bunx jest` (memoria: backend usa jest, no `bun test`).

## Risk Assessment

- **Riesgo**: reutilizar el salt de OCR por error y mezclar dominios de cifrado. Mitigación: usar literal `"chefchek-assistant"`, distinto de `"chefchek-ocr"`/`"chefchek-smtp"`, y cubrirlo en el spec.
- **Riesgo**: migración manual sin TTY falla silenciosamente. Mitigación: seguir el flujo ya documentado (`prisma migrate diff` → `migration.sql` → `prisma migrate deploy`) y verificar con `prisma migrate status` antes de pasar a fase 2.
