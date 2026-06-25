# Git Branching Strategy - ChefChek

Flujo de branching avanzado: ramas por fase/tarea, integración en `develop` y lanzamientos etiquetados desde `main`. Pensado para un monorepo con `backend/` y `frontend/` gestionados con **bun**.

## Ramas

| Rama | Propósito | Origen | Destino del PR |
|------|-----------|--------|----------------|
| `main` | Producción. Siempre desplegable. Releases se etiquetan aquí. | — | — |
| `develop` | Integración. Todo el trabajo en curso converge aquí antes de ir a main. | `main` | `main` |
| `feature/<scope>-<description>` | Nuevas funcionalidades. | `develop` | `develop` |
| `fix/<scope>-<description>` | Corrección de bugs no críticos. | `develop` | `develop` |
| `release/vX.Y.Z` | Estabilización pre-lanzamiento (opcional). | `develop` | `main` y `develop` |
| `hotfix/<scope>-<description>` | Parches urgentes en producción. | `main` | `main` y `develop` |

`<scope>` = módulo o área (`albaranes`, `ocr`, `auth`, `ci`, ...).

## Flujo de merge escalonado

```
feature/* ──▶ develop ──▶ main ──▶ tag vX.Y.Z (Release)
                              ▲
hotfix/* ─────────────────────┘
```

1. Crear rama `feature/<scope>-<desc>` desde `develop`.
2. Trabajar con commits convencionales.
3. Abrir PR a `develop`. CI (backend-ci + frontend-ci) debe pasar.
4. Merge a `develop`.
5. Periódicamente, PR `develop → main`. CI pasa.
6. Al mergear a `main`, el workflow `Release` corta un tag `vYYYYMMDD-<sha>` y una GitHub Release con notas autogeneradas.

## Commits convencionales

Ya en uso. Prefijos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`. Sin referencias a herramientas de IA en el mensaje.

Ejemplo: `feat(albaranes): add supplier picker sheet with full form`

## Versionado (SemVer)

`vMAJOR.MINOR.PATCH`:
- **MAJOR**: cambios incompatibles.
- **MINOR**: nuevas funcionalidades compatibles.
- **PATCH**: bugfixes compatibles.

El workflow `Release` actual genera tags `vYYYYMMDD-<sha>` por simplicidad. Para tags SemVer estrictos auto-generados desde commits convencionales, integrar `release-please` o similar en el futuro.

## CI/CD (GitHub Actions)

Workflows en `.github/workflows/`:

- **backend-ci.yml** — push/PR a `main`/`develop`: `bun install --frozen-lockfile`, `prisma generate`, lint, build, unit tests.
- **frontend-ci.yml** — push/PR a `main`/`develop`: `bun install --frozen-lockfile`, lint (no bloqueante mientras haya deuda), build.
- **deploy.yml** (`Release`) — push a `main`: crea tag + GitHub Release. El despliegue a Dokploy está diferido.

bun está fijado a `1.3.14` en los workflows (`oven-sh/setup-bun@v2`) para reproducibilidad.

## Hooks locales

- `.husky/pre-commit` ejecuta `lint-staged` en backend. Actualmente **no es ejecutable** en el repo (`chmod +x .husky/pre-commit` para activarlo).
- En CI se omite husky con `HUSKY=0` (el subdirectorio `backend/` no tiene `.git` en monorepo).

## Higiene

- Borrar la rama `feature/*`/`fix/*` tras mergear.
- No acumular ramas `worktree-agent-*` (artifacts de agentes); limpiar con `git worktree remove` + `git branch -D`.
- Lockfiles (`backend/bun.lock`, `frontend/bun.lock`) deben estar commiteados para que `--frozen-lockfile` funcione en CI.

## Estado actual

- `main` está por delante de `develop` (contiene merge de albaranes + fix). Antes del próximo ciclo, realinear `develop` con `git merge --ff-only main` para que vuelva a ser la base de integración.
