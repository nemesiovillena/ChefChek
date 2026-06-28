# ChefChek - Project Changelog

## Overview
SaaS multi-tenant modular para gestión de cocinas profesionales con API-first architecture.

**Version:** 0.2.0
**Status:** Development
**Backend:** NestJS + Prisma + PostgreSQL (69 modelos, 26 módulos)
**Frontend:** Next.js 16.2.6 + React 19.2.4 (implementado, compila)

---

## Estado real — 2026-06-28 (verificación contra `develop`)

Corrección de cifras desfasadas que aparecían en versiones previas de este
changelog y de `codebase-summary.md`:

- **Modelos Prisma**: 69 (no 33 ni 61 como decían versiones anteriores).
- **Módulos backend**: 26 directorios bajo `src/modules/`.
- **Frontend**: implementado y compilando (`next build` OK, 24+ rutas, 0 errores de tipo). No está "pending".
- **Auth**: Lucia Auth 3.2 session-based + RBAC operativo (migración JWT→Lucia completada en Fase 5).
- **CI**: verde en `develop` y `main` (Backend CI, Frontend CI, Release).
- **E2E backend**: 29/29 (Supertest).

La cifra "1003 tests / 85.15% coverage" corresponde a la medición del
2026-06-04; revalidar antes de citarla. Detalle actualizado en
`docs/codebase-summary.md`.

---

## Phase 1: Module Activation ✅ Completed
**Date:** 2026-05-28
**Status:** Complete

### Changes
- Activated `RecipesModule` with TipTap integration and recursive cost calculation
- Activated `MenusModule` with section-based structure and aggregated costs
- Activated `TechnicalSheetsModule` with PDF generation (pdfkit)
- Updated `backend/src/app.module.ts` with all module imports

### Key Features
- Recipe cost calculation with ingredient recursive evaluation
- Menu cost aggregation from recipes
- Allergen cascade propagation (ingredients → recipes → menus)
- Technical sheet PDF parametrization

### Files Modified
- `backend/src/app.module.ts`
- `backend/src/modules/recipes/*.ts`
- `backend/src/modules/menus/*.ts`
- `backend/src/modules/technical-sheets/*.ts`

---

## Phase 2: Prisma Schema Completion ✅ Completed
**Date:** 2026-05-29
**Status:** Complete

### Changes
- Added missing models: `Supplier`, `Stock`, `Configuration`, `Category`, `UnitConversion`, `DocumentTemplate`
- Added performance indexes on: `tenantId` (all models), `email` (User), `slug` (Menu, Recipe), `name` (Product, Category)
- Created migration: `add_missing_models_and_indexes`
- Regenerated Prisma client with updated types

### Schema Statistics
- **Total Models:** 33
- **Core Multi-tenancy:** Tenant, User, Session
- **Escandallos:** Product, Recipe, RecipeIngredient, RecipeAllergen, Menu, MenuSection, MenuItem, RecipeTranslation
- **Production:** WorkBatch, ProductionOrder, MiseEnPlaceSheet, MiseEnPlaceItem, TaskAssignment, ProgressTracking
- **APPCC:** AppccRecord, TemperatureLog, CleaningPlan, PestControl, ReceivingRecord
- **Almacenes:** Warehouse, Stock, StockMovement, Inventory, InventoryItem
- **Digital Menu:** DigitalMenuConfig, MenuScan
- **Knowledge:** KnowledgeCategory, KnowledgeArticle, KnowledgeVersion, KnowledgeTag, KnowledgeArticleTag
- **Dashboard:** DashboardMetric, DashboardAlert

### Files Modified
- `backend/prisma/schema.prisma`
- `backend/src/modules/products/products.service.ts`

---

## Phase 3: Almacenes Module ✅ Completed
**Date:** 2026-05-29
**Status:** Complete

### Changes
- Created complete warehouse management module
- Implemented stock control with theoretical vs real stock
- Added stock movements (ENTRANCE, EXIT, ADJUSTMENT)
- Implemented physical inventory system with comparison
- Added low stock alerts configuration

### Features
- CRUD operations for warehouses (name, location, capacity, conservation zone)
- Stock reservations for orders
- Stock movement history with filters
- Inventory difference generation
- Conservation zone tracking (AMBIENT, REFRIGERATED, FROZEN)

### Files Created
- `backend/src/modules/almacenes/almacenes.module.ts`
- `backend/src/modules/almacenes/almacenes.controller.ts`
- `backend/src/modules/almacenes/almacenes.service.ts`
- `backend/src/modules/almacenes/dto/almacenes.dto.ts`

---

## Phase 4: Conocimiento (Wiki) Module ✅ Completed
**Date:** 2026-05-30
**Status:** Complete

### Changes
- Created wiki system for operational procedures
- Implemented TipTap editor for rich content articles
- Added category hierarchy with parent/children relationships
- Implemented article versioning with automatic snapshots
- Added tag management with many-to-many relationships

### Features
- Article CRUD with TipTap JSON content
- Category tree structure
- Automatic version creation on edit
- Full-text search capability
- Tag-based article organization

### Files Created
- `backend/src/modules/conocimiento/conocimiento.module.ts`
- `backend/src/modules/conocimiento/conocimiento.controller.ts`
- `backend/src/modules/conocimiento/conocimiento.service.ts`
- `backend/src/modules/conocimiento/dto/conocimiento.dto.ts`

---

## Phase 5: Lucia Auth Migration ✅ Completed
**Date:** 2026-06-04
**Status:** Complete

### Changes
- Migrated from JWT to Lucia Auth v3.2.2 with PrismaAdapter
- Implemented session management in database
- Created granular RBAC system with detailed permissions
- Added secure session cookies (HttpOnly, Secure, SameSite: lax)
- Implemented multi-session support

### Features
- **LuciaAuthService:** Session lifecycle management (create, validate, invalidate, refresh)
- **SessionService:** CRUD operations for user sessions
- **PermissionsService:** Granular RBAC with dynamic permission checks
- **AuthGuard:** Uses SessionService for request validation
- **AuthService:** Session-based login/logout with bcrypt password hashing

### Files Created/Modified
- `backend/src/modules/auth/lucia-auth.service.ts`
- `backend/src/modules/auth/session.service.ts`
- `backend/src/modules/auth/permissions.service.ts`
- `backend/src/modules/auth/auth.service.ts` (updated)
- `backend/src/guards/auth.guard.ts` (updated)
- `backend/src/guards/permission.guard.ts` (created)
- `backend/src/guards/roles.guard.ts` (created)
- `backend/test/e2e/auth-flow.e2e-spec.ts`

---

## Phase 6: Digital Menu QR Module ✅ Completed
**Date:** 2026-05-30
**Status:** Complete

### Changes
- Created QR code generation system for digital menus
- Implemented public multilingual menu view
- Added allergen filtering complying with UE 1169/2011
- Built analytics tracking (scans, language usage, interaction types)
- Implemented customizable branding (colors, fonts, logo)

### Features
- QR code generation (mock URL-based approach)
- Public menu endpoints (bypass auth)
- Real-time allergen filtering
- Multilingual support with dynamic slugs
- Scan analytics with device detection

### Files Created
- `backend/src/modules/digital-menu/digital-menu.module.ts`
- `backend/src/modules/digital-menu/digital-menu.controller.ts`
- `backend/src/modules/digital-menu/digital-menu.service.ts`
- `backend/src/modules/digital-menu/dto/digital-menu.dto.ts`

---

## Phase 7: Ingesta (Telegram + OCR) ✅ Completed
**Date:** 2026-06-04
**Status:** Complete

### Changes
- Implemented Telegram bot integration with secure webhooks
- Created OCR service using Tesseract.js for document data extraction
- Built AI-powered product recognition service
- Implemented Bull-based processing queue for async operations
- Added cost recalculation in cascade on product updates

### Features
- **TelegramBotService:** Bot lifecycle, webhook management, user authorization
- **OcrAiService:** Document OCR with Tesseract.js, data extraction, confidence scoring
- **ProductRecognitionService:** AI-based product identification from extracted data
- **DocumentQueueProcessor:** Bull queue for async document processing
- Multi-format support (PDF, images)
- Automatic product creation on unknown items
- Cost recalculation triggers on product price updates

### Files Created
- `backend/src/modules/ingesta/ingesta.module.ts`
- `backend/src/modules/ingesta/ingesta.controller.ts`
- `backend/src/modules/ingesta/ingesta.service.ts`
- `backend/src/modules/ingesta/telegram-bot.service.ts`
- `backend/src/modules/ingesta/ocr-ai.service.ts`
- `backend/src/modules/ingesta/product-recognition.service.ts`
- `backend/src/modules/ingesta/document-queue.processor.ts`
- `backend/src/modules/ingesta/dto/ingesta.dto.ts`

---

## Phase 8: Dashboard Interactive Module ✅ Completed
**Date:** 2026-05-31
**Status:** Complete

### Changes
- Created comprehensive dashboard with KPIs and metrics
- Implemented cost trend analysis
- Added menu margin analysis with threshold warnings
- Built alert system with statistics
- Implemented alert resolution workflow

### Features
- Real-time KPI calculation (costs, margins, stock, alerts)
- Cost trend analysis with simulated data fallback
- Menu margin analysis with profit warnings
- Alert statistics by type and severity
- Configurable metrics and alerts

### Files Created
- `backend/src/modules/dashboard/dashboard.module.ts`
- `backend/src/modules/dashboard/dashboard.controller.ts`
- `backend/src/modules/dashboard/dashboard.service.ts`
- `backend/src/modules/dashboard/dto/dashboard.dto.ts`

---

## Phase 9: Sala (QR Scanner) Module ✅ Completed
**Date:** 2026-06-04
**Status:** Complete

### Changes
- Implemented QR validation and redirection system
- Created menu access tracking with analytics
- Built customer feedback collection system
- Added incident reporting workflow

### Features
- **QR validation:** Secure code verification, tenant isolation, menu lookup
- **Access tracking:** Scan analytics, language usage, interaction types
- **Feedback system:** Customer satisfaction scores, detailed comments
- **Incident reporting:** Real-time incident logging, severity classification, resolution tracking

### Files Created
- `backend/src/modules/sala/sala.module.ts`
- `backend/src/modules/sala/sala.controller.ts`
- `backend/src/modules/sala/sala.service.ts`
- `backend/src/modules/sala/dto/sala.dto.ts`

---

## Phase 10: Core Utilities Module ✅ Completed
**Date:** 2026-05-31
**Status:** Complete

### Changes
- Created global services shared across modules
- Implemented in-memory cache with TTL
- Added email service with HTML templates
- Created notifications service reusing Alert model

### Features
- **CacheService:** Map-based cache with 5-minute default TTL
  - `set(key, value, ttl?)` - store with optional expiration
  - `get(key)` - retrieve value
  - `delete(key)` - remove value
  - `clear()` - clear all values
  - `clearPattern(prefix)` - clear values matching pattern
  - `getStats()` - get cache statistics

- **EmailService:** Mock email service
  - Notification emails (INFO, WARNING, ERROR)
  - Alert emails with severity color coding
  - Welcome emails for new users

- **NotificationsService:**
  - Individual notifications
  - Bulk notifications by user roles

### Files Created
- `backend/src/modules/core/core.module.ts` (Global scope)
- `backend/src/modules/core/cache.service.ts`
- `backend/src/modules/core/email.service.ts`
- `backend/src/modules/core/notifications.service.ts`

---

## Phase 11: Testing and QA ✅ Completed
**Date:** 2026-06-04
**Status:** Complete

### Changes
- Fixed Jest configuration (CommonJS format, ESM transform for lucia/@oslojs)
- Created comprehensive test suite for all 12 modules
- Implemented E2E auth flow testing
- Achieved 85.15% test coverage (exceeds 70% target by 15.15%)

### Test Statistics
- **Test Suites:** 47 passing
- **Tests:** 1003 passing
- **Coverage:** 85.15% statements, 75.7% branches, 87.38% functions, 85.79% lines
- **Execution Time:** 11.83s

### Module Coverage Highlights
- Core (cache, email, notifications): 100% statements ✅
- Auth (Lucia, session, permissions): 84.33% statements ✅
- Products: 98.43% statements ✅
- Orders: 98.73% statements ✅
- Recipes: 91.25% statements ✅
- Production: 82.45% statements ✅
- Menus: 95.12% statements ✅
- Dashboard: 90.83% statements ✅

### Files Created/Modified
- `backend/jest.config.js` (fixed)
- `backend/test/setup.ts`
- Test files for all 12 modules (47 test suites)
- `backend/test/e2e/auth-flow.e2e-spec.ts`

---

## Phase 12: Documentation and Deployment ✅ Partial
**Date:** 2026-06-01
**Status:** In Progress (Swagger complete, remaining pending)

### Completed Changes
- **Swagger/OpenAPI Documentation:**
  - Configured Swagger in `backend/src/main.ts`
  - Added Swagger decorators to all controllers:
    - Core: tenants, auth, users
    - Business Logic: products, recipes, menus
    - Specialized: production, appcc, allergens, orders
    - New Modules: almacenes, digital-menu, dashboard
  - Swagger UI available at: http://localhost:3001/api/docs

### Swagger Documentation Details
- All endpoints documented with `@ApiOperation`, `@ApiResponse`
- Authentication configured with Bearer JWT
- API tags organized by module
- Parameters documented with `@ApiParam`, `@ApiQuery`, `@ApiHeader`
- Response codes and descriptions included

### Files Modified
- `backend/src/main.ts` (Swagger setup)
- All controller files (added Swagger decorators)

### Pending Documentation Tasks
- Create user guides and tutorials
- Write API usage examples
- Document authentication flow
- Create deployment guide
- Add environment variables documentation
- Document database backup strategies

---

## Current Project Status

### Completed Phases: 11/12 (92%)
- ✅ Fase 1: Module Activation
- ✅ Fase 2: Prisma Schema Completion
- ✅ Fase 3: Almacenes Module
- ✅ Fase 4: Conocimiento Wiki Module
- ✅ Fase 5: Lucia Auth Migration
- ✅ Fase 6: Digital Menu QR Module
- ✅ Fase 7: Ingesta Module (Telegram + OCR)
- ✅ Fase 8: Dashboard Interactive Module
- ✅ Fase 9: Sala Module (QR Scanner)
- ✅ Fase 10: Core Utilities Module
- ✅ Fase 11: Testing (85.15% coverage achieved)
- ✅ Fase 12: Documentation (Swagger complete, user guides pending)

### Backend Compilation Status
- **Errors:** 0
- **Warnings:** None
- **Status:** ✅ Compilation Successful
- **Tests:** 1003/1003 passing (47 suites)

### Database Status
- **Total Models:** 69 models (verificado 2026-06-28)
- **Multi-tenant:** All models isolated by tenantId
- **Seeded Data:** ✅ Complete (tenant, users, categories, suppliers, products, recipes, menus, sprints, tasks)
- **Performance:** Indexes on tenantId and frequently queried fields

### Key Technologies
- **Backend:** NestJS 10.x, TypeScript 5.x
- **Database:** PostgreSQL 14 with Prisma ORM v5.22.0
- **Authentication:** Lucia Auth v3.2.2 with session-based auth
- **RBAC:** Granular permissions system
- **Documentation:** Swagger/OpenAPI 3.0
- **Testing:** Jest with 85.15% coverage
- **Editor:** TipTap (rich content)
- **PDF Generation:** pdfkit, pdf-lib
- **QR Codes:** qrcode library
- **OCR:** Tesseract.js
- **Queue:** Bull (Redis-based)
- **Telegram:** Telegraf v4.16.3

---

## Next Steps

### Immediate Priorities
1. ✅ Fix Jest configuration to enable test execution - DONE
2. ✅ Database seeding with synthetic data - DONE
3. ⏳ Create user guides and API usage documentation (PENDING)
4. ⏳ Document deployment process and environment variables (PENDING)

### Quality Improvements
1. ✅ Achieve >80% test coverage - DONE (85.15%)
2. ✅ Implement E2E tests - DONE
3. ⏳ Add security audit (PENDING)
4. ⏳ Performance testing and optimization (PENDING)
5. ⏳ Frontend development (Next.js) (PENDING)

---

## Contributors
- ChefChek Team

## License
MIT

---

**Last Updated:** 2026-06-28
**Backend Version:** 0.2.0
**Documentation Version:** 0.2.0