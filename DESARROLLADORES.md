# ChefChek — Guía para desarrolladores

Cómo arrancar ChefChek en local, cómo está organizado y cómo se lleva un cambio a producción. Lo que hace la aplicación está en el [README](README.md); el detalle técnico de cada módulo está en [`docs/`](docs/).

## Stack

| Parte | Tecnología | Carpeta | Puerto local |
|---|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TanStack Query | `frontend/` | 3000 |
| Backend (API) | NestJS 11, Prisma 5, PostgreSQL 15, Socket.IO | `backend/` | 3001 |
| Lectura de albaranes | Python, FastAPI, EasyOCR + IA | `backend/ocr-microservice/` | 8000 |

Gestor de paquetes JS: **bun** (no npm). La API cuelga de `/api/v1/…`.

## Requisitos

- [bun](https://bun.sh)
- PostgreSQL 15 escuchando en `localhost:5432`, local o con `docker compose up postgres`
- Python 3 (solo para el microservicio de albaranes)

## Arranque en local

```bash
# 1. Microservicio de albaranes (solo la primera vez): crea su venv con los SDK de IA
cd backend/ocr-microservice && ./install.sh && cd ../..

# 2. Base de datos: aplicar migraciones
cd backend && bun install && bunx prisma migrate deploy && cd ..

# 3. Arrancar todo
./scripts/dev-up.sh
```

`scripts/dev-up.sh` comprueba Postgres, instala dependencias si faltan, crea `backend/.env` desde `.env.example` y arranca backend, frontend y microservicio. Si un servicio ya está en marcha en su puerto, no lo relanza. Para pararlo todo, `Ctrl+C`.

Abrir <http://localhost:3000>. El login pide el identificador del restaurante (*tenant*) además del usuario.

> ⚠️ `bun run db:seed` **vacía todas las tablas** (TRUNCATE) antes de cargar los datos de ejemplo. No lo lances contra una base con datos reales; si acaso, usa `db:seed:no-reset`.

## Variables de entorno

| Archivo | Claves principales |
|---|---|
| `backend/.env` (desde `.env.example`) | `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CONFIG_ENCRYPTION_KEY`; opcionales: `BUNNY_*` (imágenes y copias), `PEXELS_API_KEY`, `GOOGLE_CLOUD_VISION_API_KEY` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` (si falta, usa `http://localhost:3001/api`) |
| `backend/ocr-microservice/.env` (desde `.env.example`) | `PORT`, `OCR_LANGUAGE`, claves del proveedor de IA |

Las claves de IA del asistente y de la lectura de albaranes también se configuran desde **Configuración** dentro de la app. Nunca subas un `.env` al repositorio.

## Organización del código

- **Multi-tenant.** Cada restaurante es un *tenant* y todas sus consultas van filtradas por su `tenantId`.
- **Módulos activables por cliente.** El catálogo está en `backend/src/modules/modules/constants/registry.ts`. Los endpoints se protegen con `@RequireModule(...)`, y el menú del frontend (`frontend/src/features/modules/lib/nav-config.ts`) oculta lo que el cliente no tiene activo.
- **Borrado suave.** La mayoría de entidades se marcan con `deletedAt` en lugar de borrarse y se recuperan desde la Papelera.
- **Esquema y migraciones** en `backend/prisma/`.

## Tests

```bash
cd backend
bun run test        # unitarios (Jest; no usar `bun test`)
bun run test:e2e    # e2e de la API
```

Los e2e **solo se ejecutan contra una base cuyo nombre termine en `_test`** (p. ej. `chefchek_test`), con las migraciones aplicadas. `test/setup.ts` aborta si `DATABASE_URL` apunta a otra base, para no borrar datos reales.

En el frontend: `bun run lint`, `bun run build` y `bun run test:e2e` (Playwright).

## Flujo de trabajo

1. Rama desde `develop`: `feat/…`, `fix/…` o `docs/…`.
2. Commits con formato convencional, en español: `fix(etiquetas): …`. El hook de *pre-commit* (husky + lint-staged) pasa ESLint y Prettier.
3. PR contra **`develop`**. CI (*Backend CI* y *Frontend CI*) ejecuta lint, build, unitarios y e2e. Se fusiona cuando todo está en verde.
4. **Producción:** PR de *release* de `develop` a `main` (título `release: …`, merge normal). Al entrar en `main`, Dokploy redespliega solo el servicio cuyos archivos cambiaron (`backend/`, `frontend/` o el microservicio). Nunca se hace push directo a `main`.

Más detalle en [`docs/git-branching-strategy.md`](docs/git-branching-strategy.md) y [`docs/deployment.md`](docs/deployment.md).
