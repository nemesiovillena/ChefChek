# Triaje de vulnerabilidades de dependencias — riesgo aceptado

**Fecha:** 2026-09-01 · **Fuente:** `cd backend && bun audit` (35 advisories: 20 high, 12 moderate, 3 low) · Complementa `security-audit-260831-0018-*.md` (donde se cerraron `socket.io-parser`, `qs`, `form-data`, `multer`, `ws`).

## Conclusión

Ninguno de los 35 restantes es accionable con bajo riesgo:

- **La mayoría no llega a producción.** El `Dockerfile` de backend instala con `bun install --frozen-lockfile --production`, así que `eslint`, `jest`, `@nestjs/cli`, `ts-loader`, `@typescript-eslint/*`, `lint-staged`, `ts-jest` y todo su árbol transitivo **no van en la imagen**.
- **Los que sí van a producción están en rutas de código no alcanzables** por entrada no confiable.
- **No hay `overrides` limpios.** Los paquetes vulnerables (`minimatch`, `brace-expansion`, `glob`, `picomatch`, `tmp`…) conviven en varias major versions en el árbol (p. ej. `minimatch` 3.x + 9.x + 10.x). Un `override` global rompe los consumidores de la major antigua; `bun update` no toca los transitivos profundos y `bun update --latest <pkg>` los añade como dependencias directas (contraproducente). Probado y revertido.

## Solo build/CI — no van a producción

| Paquete | Advisory | Por qué no importa |
|---|---|---|
| `ajv` <8.18.0 | ReDoS `$data` | webpack schema-utils (build). Inputs = schemas del propio bundler. |
| `brace-expansion` <1.1.17 | DoS | patrones glob de eslint/jest/tsc sobre el propio repo. |
| `minimatch` <9.0.6 | ReDoS | ídem. La copia de `glob` ya es 9.0.9 (parcheada); solo `@typescript-eslint` arrastra 9.0.3. |
| `tmp` <=0.2.3 | Path traversal prefix/postfix | `@nestjs/cli` → inquirer → external-editor. Solo en `nest generate` local. |
| `webpack` buildHttp | allowlist bypass SSRF | `HttpUriPlugin` no se usa. |
| `glob` <10.5.0 | Command injection `-c/--cmd` | solo el **CLI** de glob; el proyecto usa la API programática. |
| `fast-uri` <3.1.5 | Host confusion | parsing de URIs dentro de `ajv` (build). |

## Van a producción pero ruta no explotable

| Paquete | Advisory | Análisis |
|---|---|---|
| `lodash` <=4.17.22 | Code injection `_.template` | Vía `@nestjs/config` / `@nestjs/swagger` / `bull`. Ninguno pasa plantillas de usuario a `_.template`. **No hay versión parcheada** (lodash sin mantenimiento) → override imposible. |
| `js-yaml` (v3 branch) | DoS cuadrático merge keys | Vía `@nestjs/swagger`. **Swagger está deshabilitado en producción** (`NODE_ENV !== "production"` en `main.ts`); la ruta de serialización YAML nunca se ejecuta. |
| `protobufjs` <=7.6.2 | DoS parsing `.proto` | Vía `@google-cloud/vision` → `google-gax`. Carga solo sus `.proto` embebidos, nunca entrada externa. |
| `uuid` <11.1.1 | Buffer bounds en v3/v5/v6 con `buf` | Dependencia directa ya en v14. Copias vulnerables (`bull`, `google-gax`) usan **v4 sin `buf`** → distinta ruta. |
| `file-type` <21.3.1 | Bucle infinito / zip bomb | Vía `@nestjs/common`, solo se carga con `FileTypeValidator`/`ParseFilePipe` — **no se usan** en el código. |
| `typeorm` (`migration:generate` injection) | template-literal injection | Solo el comando CLI `migration:generate` (dev). El runtime no lo ejecuta. Ver recomendación. |
| `picomatch` <4.0.4 | ReDoS extglob / method injection | Casi todo dev. Ruta prod única: `typeorm → tinyglobby → fdir → picomatch`, con patrones de config, no de usuario. |

## Recomendaciones (no urgentes)

1. **Eliminar `typeorm` + `@nestjs/typeorm` + `src/entities/*`.** Verificado muerto: no hay `TypeOrmModule` en ningún módulo, los 6 `*.entity.ts` (sprint/task/team-member… — andamiaje inicial ajeno al dominio) no se importan en ningún sitio. Quita el advisory de `typeorm` y la cadena `picomatch` de producción. **Ojo:** al quitarlo, `bun` regenera el lockfile y en una prueba rompió la resolución de tipos de `nest build` — hacerlo con cuidado (lockfile) cuando se vaya a tocar deps de todas formas.
2. **Revisar el resto al actualizar NestJS / toolchain.** Estos advisories se resuelven cuando `@nestjs/cli`, `eslint`, `jest` y `@typescript-eslint` suban sus transitivos. No merece forzarlo antes.
3. **CI:** `bun audit` corre informativo, no bloqueante — correcto dado lo anterior.

## Preguntas abiertas

- ¿Se confirma que el módulo project-management (entities TypeORM: sprint, task, team-member) es andamiaje muerto y se puede borrar?
