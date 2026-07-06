# ChefChek - Codebase Summary

> Última verificación: 2026-06-29 (contra `develop`). Las cifras de este
> documento se comprobaron contra el código, no contra versiones anteriores.

## Overview
SaaS multi-tenant para gestión de cocinas profesionales, arquitectura API-first.
Backend NestJS + Prisma + PostgreSQL; frontend Next.js (App Router) + React 19.

## Architecture

### Backend (NestJS + TypeScript)
- **Framework**: NestJS (`@nestjs/common` ^10 / `@nestjs/core` ^11 — mezcla a consolidar) + TypeScript 5
- **Database**: PostgreSQL 14+ con Prisma ORM 5.20
- **Authentication**: Lucia Auth 3.2 (session-based, sesiones en DB) con RBAC granular. Ya NO usa JWT.
- **API**: RESTful con Swagger/OpenAPI en `http://localhost:3001/api/docs`
- **Multi-tenancy**: aislamiento estricto por `tenantId` en cada modelo
- **Módulos**: 26 directorios bajo `backend/src/modules/`
- **Migrations**: 2 (`init`, `add_owner_role`)

### Frontend (Next.js 16.2.6 + React 19.2.4)
- **Framework**: Next.js App Router con SSR (no static export) + React 19
- **Styling**: Tailwind CSS 4 + design system centralizado
- **Internationalization**: next-intl 4
- **Editor**: TipTap 3 (contenido enriquecido)
- **Datos**: axios + React Query 5; estado con Zustand
- **Rutas**: dashboard con 22 submódulos navegables + login/register. Verifica estado real en `docs/codebase-summary.md` vs. el changelog histórico.

## Modules (26)
Organizados por dominio bajo `backend/src/modules/`:

- **Core / Auth**: `auth`, `tenants`, `users`, `core`, `modules`
- **Escandallos (costos)**: `products`, `recipes`, `menus`, `technical-sheets`, `escandallos`, `categories`
- **Seguridad / cumplimiento**: `allergens`, `appcc`, `seguridad`
- **Producción**: `production`, `produccion`, `orders`, `sprint`
- **Almacenes**: `almacenes`
- **Sala / carta digital**: `digital-menu`, `qr`, `sala`
- **Albaranes + OCR**: `albaranes` (gestión, alta manual y upload de albaranes) + `ocr` (motor OCR/IA compartido para lectura de albaranes)
- **Conocimiento**: `conocimiento` (wiki/procedimientos)
- **Visión**: `dashboard`

> Nota: `production`/`produccion` y `escandallos`/`seguridad` coexisten como
> directorios; revisar si son duplicados funcionales o agrupaciones.

## Database Schema

- **Total models**: 69 (catálogo completo en `backend/prisma/schema.prisma`)
- **Multi-tenant**: todos los modelos aislados por `tenantId`
- **Performance**: índices en `tenantId` y campos de consulta frecuente
- **Seed**: seed coherente multi-módulo (56+ modelos encadenados). Ver `docs/QUICKSTART.md`.

## API Documentation

- Swagger/OpenAPI completo: `http://localhost:3001/api/docs`
- Auth: sesiones Lucia (cookie), header multi-tenant `X-Tenant-Id`
- RBAC: roles `OWNER`, `ADMIN`, `USER`, `VIEWER` + permisos granulares

## Key Technologies

| Capa | Stack |
|---|---|
| Backend | NestJS 10/11, TypeScript 5, Prisma 5.20, PostgreSQL 14, Lucia Auth 3.2, Swagger |
| Frontend | Next.js 16.2.6, React 19.2.4, Tailwind 4, TipTap 3, React Query 5, Zustand, next-intl 4 |
| Testing | Jest (backend), Vitest (frontend, planificado), Playwright (frontend smoke), e2e Supertest (backend) |
| DevOps | Docker + docker-compose, GitHub Actions (Backend CI, Frontend CI, Release), Husky + lint-staged |

## Project Status (2026-06-28)

| Frente | Estado |
|---|---|
| CI (`develop` + `main`) | 🟢 Verde (Backend CI, Frontend CI, Release) |
| Backend | 🟢 Compila (`nest build`), 69 modelos, 26 módulos, seed coherente |
| Frontend | 🟢 Compila (`next build`), 24+ rutas; 0 errores de tipo |
| Lint frontend | 🟡 0 errores, ~125 warnings (cosmético, `unused-vars`) |
| Tests backend (unit) | 🟢 1340 tests, 79 suites (medido 2026-06-29) |
| E2E backend | 🟢 29/29 (Supertest) |
| Docs | 🟢 Sincronizados (2026-06-29) |

> El porcentaje global ("X% completo") es orientativo y no se mantiene
> automáticamente; confiar en CI + build como indicador de salud.

## Known Debt / Next

- Consolidar versión NestJS (common 10 vs core 11) en el backend.
- Cerrar warnings de lint del frontend (~125, mayoría `unused-vars`).
- Cobertura de tests backend: última medición formalizada 2026-06-04 (85.15%); revalidar antes de citar.

---
**Última verificación**: 2026-06-29 · **Rama**: `develop` · **Versión**: 0.2.0
