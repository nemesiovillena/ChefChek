# ChefChek - Estrategia de Pruebas y Despliegue

## Overview

Documento que detalla la estrategia completa de pruebas y despliegue para ChefChek, asegurando calidad técnica y estabilidad en producción.

---

## Estado de implementación (2026-06)

- **Gestor de paquetes**: bun (no npm). Todos los comandos y workflows usan `bun install --frozen-lockfile` y `bun run <script>`. Versión fijada en CI: `1.3.14`.
- **Branching**: definido en `docs/git-branching-strategy.md` (feature → develop → main, tags en main).
- **CI/CD**: workflows reales en `.github/workflows/` (`backend-ci.yml`, `frontend-ci.yml`, `deploy.yml`). Ver sección "Pipeline CI/CD".
- **Despliegue a Dokploy**: diferido hasta que el proyecto esté más avanzado. El workflow `deploy.yml` solo corta release/tag en main; el despliegue real se añadirá cuando se active Dokploy.

### Scripts reales disponibles

- **Backend**: `build`, `lint`, `test`/`test:unit` (jest, 1110 tests), `test:cov`, `test:e2e` (jest-e2e contra Postgres), `prisma:*`.
- **Frontend**: `dev`, `build`, `start`, `lint`, `test:e2e` (Playwright, smoke).

Las secciones siguientes que mencionan `test:integration`, `test:performance`, `test:stress`, `test:migration`, `test:coverage:check` o `analyze` describen **objetivos planeados**, no scripts existentes. Los dirs `backend/test/{integration,load}` están vacíos; migrar esos comandos a scripts reales es trabajo pendiente (issue aparte). `test:unit` y `test:e2e` (backend y frontend) ya existen.

### Cobertura y E2E en CI

- **Cobertura (backend)**: el umbral 70% global en `jest.config.js` es **advisory** (solo aplica en local con `test:cov`). CI reporta cobertura sin bloquear.
- **Backend E2E**: job `e2e` en `backend-ci.yml` con servicio Postgres + `prisma migrate deploy`, `continue-on-error` (no bloqueante mientras se estabilizan los specs).
- **Frontend E2E**: job `e2e` en `frontend-ci.yml` con Playwright (chromium), `continue-on-error`. Suite smoke: render de `/login` y redirect `/dashboard` → `/login` (sin backend).

---

## Estrategia de Pruebas

### 1. Tests Unitarios

#### Objetivos
- **Backend**: 90% cobertura
- **Frontend**: 80% cobertura
- Enfocados en lógica de negocio individual
- Aislados de dependencias externas

#### Backend Tests
```bash
cd backend
bun run test:unit              # Unit tests only
bun run test -- --coverage     # Con reporte de cobertura
bun run test -- --verbose      # Detallado
```

**Categorías**:
- Servicios y lógica de negocio
- DTOs y validadores
- Utilidades y helpers
- Middleware

#### Frontend Tests
```bash
cd frontend
bun run test                   # Unit tests
bun run test -- --coverage     # Con reporte de cobertura
bun run test:watch             # Watch mode
```

**Categorías**:
- Hooks personalizados (use-*.ts)
- Utilidades (lib/*.ts)
- Componentes UI
- Servicios de API

### 2. Tests de Integración

#### Backend Integration Tests
```bash
cd backend
bun run test:integration
```

**Cobertura**:
- APIs con base de datos real
- Comunicación entre servicios
- Autenticación y autorización
- Multi-tenancy
- Transacciones de base de datos

#### Frontend Integration Tests
```bash
cd frontend
bun run test:integration
```

**Cobertura**:
- Integración con API backend
- TanStack Query caching
- Context providers
- Comunicación componente-padre-hijo

### 3. Tests E2E

#### Pruebas E2E con Playwright

**Setup**:
```bash
cd frontend
bun add -D @playwright/test
bunx playwright install
```

**Ejecución**:
```bash
bun run test:e2e                 # Todos los tests
bun run test:e2e:headless        # Sin UI
bun run test:e2e:ui              # Con UI
```

**Flujos Críticos**:
1. **Autenticación Completa**
   - Registro de nuevo tenant
   - Login con credenciales válidas
   - Refresh de sesión
   - Logout
   - Cambio de tenant

2. **Gestión de Productos**
   - Crear producto nuevo
   - Editar producto existente
   - Buscar y filtrar productos
   - Ver detalles de producto
   - Eliminar producto

3. **Gestión de Recetas**
   - Crear receta nueva
   - Agregar ingredientes
   - Editar instrucciones
   - Calcular costos
   - Publicar receta

4. **Producción y Órdenes**
   - Crear orden de producción
   - Asignar tareas
   - Actualizar estados
   - Completar orden
   - Generar reportes

5. **APPCC y Cumplimiento**
   - Registrar temperatura
   - Crear plan de limpieza
   - Generar reporte de cumplimiento
   - Ver alertas

### 4. Tests de Rendimiento

#### Backend Performance Tests
```bash
cd backend
bun run test:performance
```

**Objetivos**:
- Tiempo de respuesta API < 200ms (percentil 95)
- Consultas de base de datos < 50ms
- Caché de respuestas API
- Manejo de 1000 usuarios concurrentes

**Herramientas**:
- LoadRunner
- k6
- Apache JMeter

#### Frontend Performance Tests
```bash
cd frontend
bun run build -- --profile production
bun run analyze                 # Bundle analysis
```

**Objetivos**:
- Lighthouse score > 90
- Time to Interactive < 3s
- First Contentful Paint < 1.5s
- Bundle size < 500KB

### 5. Tests de Estrés

#### Backend Stress Testing
```bash
cd backend
bun run test:stress
```

**Escenarios**:
- 10,000 requests concurrentes
- Picos de tráfico repentinos
- Recuperación de fallos
- Comportamiento bajo carga extremas

#### Frontend Stress Testing
```bash
cd frontend
bun run test:stress
```

**Escenarios**:
- Páginas pesadas con datos
- Múltiples tabs abiertos
- Cambios rápidos de estado
- Operaciones complejas simultáneas

---

## Estrategia de Despliegue

### 1. Ambiente Staging

#### Configuración
- Réplica completa de producción
- Datos de prueba realistas
- Acceso limitado a equipo
- Monitoreo completo

#### Proceso
1. Desplegar código nuevo
2. Ejecutar todas las pruebas
3. Verificar funcionalidad crítica
4. Pruebas de usuario manual
5. Performance testing
6. Revisión de logs y métricas

### 2. Pruebas de Migración de Datos

#### Verificación
```bash
cd backend
bun run test:migration           # Tests de migración
bunx prisma migrate deploy       # Desplegar migraciones
bunx prisma migrate status       # Verificar estado
```

**Consideraciones**:
- Migraciones deben ser reversibles
- Datos existentes no se pierden
- Tiempo de migración aceptable
- Backups automáticos antes de migrar

### 3. Validación de Rendimiento

#### Métricas en Staging
```bash
# Backend
curl -w "@curl-format.txt" http://staging-api.chefchek.com/api/v1/health

# Frontend
lighthouse https://staging.chefchek.com --view
```

**Validación**:
- API response times < 200ms
- Database queries < 50ms
- Lighthouse scores > 90
- Cache hit rates > 80%

### 4. Despliegue Blue-Green

#### Arquitectura
- **Blue**: Versión actual en producción
- **Green**: Nueva versión desplegada
- **Load Balancer**: Distribuye tráfico
- **Switch Instantáneo**: Cambio sin downtime

#### Proceso
1. Desplegar versión nueva en Green
2. Ejecutar pruebas completas en Green
3. Verificar métricas y logs
4. Cambiar tráfico a Green
5. Monitorear por 24-48 horas
6. Mantener Blue por 24 horas como rollback

### 5. Plan de Rollback

#### Situaciones que Requieren Rollback
- Bugs críticos en funcionalidad principal
- Performance degradation > 20%
- Error rate > 1%
- Issues de seguridad
- Feedback negativo significativo de usuarios

#### Proceso de Rollback
1. Identificar versión anterior estable
2. Preparar comando de rollback
3. Notificar stakeholders
4. Ejecutar rollback (máx. 10 minutos)
5. Verificar estabilidad post-rollback
6. Análisis root cause
7. Plan de corrección

---

## Pipeline CI/CD

Workflows reales implementados en `.github/workflows/` con **bun** (versión `1.3.14`, `oven-sh/setup-bun@v2`). El despliegue a Dokploy está diferido; `deploy.yml` solo corta releases.

### 1. Backend CI (`backend-ci.yml`)

Dispara en push/PR a `main` y `develop`.

```yaml
name: Backend CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
defaults:
  run:
    working-directory: backend
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - name: Install
        run: bun install --frozen-lockfile
        env:
          HUSKY: '0'
      - run: bunx prisma generate
      - name: Lint
        run: bun run lint
      - name: Build
        run: bun run build
      - name: Unit tests
        run: bun run test
```

Estado verificado: lint (0 errores), build OK, 1110 tests pasan.

Adicionalmente, el job `e2e` (no-bloqueante, `continue-on-error`) levanta un servicio Postgres, aplica `prisma migrate deploy` y corre `bun run test:e2e`. El YAML embebido arriba es ilustrativo; el fuente de verdad es `.github/workflows/backend-ci.yml`.

### 2. Frontend CI (`frontend-ci.yml`)

Dispara en push/PR a `main` y `develop`.

```yaml
name: Frontend CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
defaults:
  run:
    working-directory: frontend
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - name: Install
        run: bun install --frozen-lockfile
        env:
          HUSKY: '0'
      - name: Lint
        run: bun run lint
        continue-on-error: true   # deuda de lint (~200 errores); endurecer cuando se salde
      - name: Build
        run: bun run build
```

Estado verificado: build OK. Lint pasa (0 errores, ~125 warnings de deuda no bloqueante). Adicionalmente, el job `e2e` (no-bloqueante) instala Playwright/chromium y corre `bun run test:e2e` (smoke). El YAML embebido arriba es ilustrativo; el fuente de verdad es `.github/workflows/frontend-ci.yml`.

### 3. Release (`deploy.yml`)

Dispara en push a `main` (o manual). Crea un tag `vYYYYMMDD-<sha>` y una GitHub Release con notas autogeneradas. **No despliega** (Dokploy diferido).

```yaml
name: Release
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Compute tag
        id: tag
        run: echo "tag=v$(date +%Y%m%d)-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.tag.outputs.tag }}
          name: ${{ steps.tag.outputs.tag }}
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Pendiente

- Endurecer lint del frontend (quitar `continue-on-error`) tras saldar la deuda.
- ~~Añadir job `deploy` a `deploy.yml` cuando se active Dokploy~~ — Dokploy ya está activo (2026-07-19): project "ChefChek" en el VPS Hostinger con 3 apps (`backend`, `frontend`, `ocr-microservice`) + Postgres gestionado, auto-deploy en push a `main`. Detalle en `docs/deployment.md`. Falta añadir el job `deploy` explícito a `deploy.yml` si se quiere que el pipeline de GitHub Actions dispare el deploy en vez de depender solo del webhook de Dokploy.
- Migrar `backend/Dockerfile` de npm a bun para consistencia — **ya hecho**, el Dockerfile actual usa `oven/bun:1.3.14` multi-stage (ver `backend/Dockerfile`).
- Scripts de tests E2E/integración/rendimiento reales (los referenciados en "Estrategia de Pruebas" son planeados).

## Monitoreo y Alertas

### 1. Métricas Clave

#### Backend Metrics
- **API Response Time**: < 200ms (p95)
- **Database Query Time**: < 50ms
- **Error Rate**: < 0.1%
- **Uptime**: > 99.5%
- **Cache Hit Rate**: > 80%

#### Frontend Metrics
- **Lighthouse Score**: > 90
- **Time to Interactive**: < 3s
- **First Contentful Paint**: < 1.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to First Byte**: < 600ms

### 2. Alertas

#### Alertas Críticas
- Error rate > 1%
- API response time > 500ms
- Database query failures
- Authentication failures
- Payment processing failures

#### Alertas de Advertencia
- Cache miss rate > 20%
- Slow queries > 100ms
- High memory usage (> 80%)
- Disk space < 20%

---

## Checklist de Pre-Producción

### Backend
- [ ] Todos los tests unitarios pasan
- [ ] Todos los tests de integración pasan
- [ ] Coverage ≥ 90%
- [ ] Security audit sin vulnerabilidades críticas
- [ ] Performance tests cumplen objetivos
- [ ] Migraciones de base de datos preparadas
- [ ] Backups de base de datos verificados
- [ ] Variables de entorno configuradas
- [ ] Rate limiting configurado
- [ ] Logs configurados correctamente

### Frontend
- [ ] Todos los tests unitarios pasan
- [ ] Todos los tests de integración pasan
- [ ] Coverage ≥ 80%
- [ ] Lighthouse score > 90
- [ ] Bundle size < 500KB
- [ ] No console errors en producción
- [ ] Build optimizado
- [ ] Imágenes optimizadas
- [ ] CSS/JS minificados
- [ ] Service Workers configurados

### Infraestructura
- [ ] Servidores provisionados
- [ ] Base de datos configurada
- [ ] SSL/TLS certificados instalados
- [ ] DNS configurado
- [ ] Load balancers activos
- [ ] Monitoreo configurado
- [ ] Logging configurado
- [ ] Backup strategy implementada
- [ ] CDN configurado
- [ ] CDN cache configurado

---

## Tiempos Estimados

| Fase | Duración Estimada | Notas |
|------|-------------------|-------|
| Tests Unitarios | 2-3 días | Backend + frontend |
| Tests Integración | 2 días | APIs + base de datos |
| Tests E2E | 2 días | Playwright setup |
| Tests Performance | 1 día | Load testing |
| Configuración CI/CD | 1 día | Pipeline setup |
| Deploy Staging | 0.5 días | Primera iteración |
| Validación Staging | 1-2 días | Pruebas manuales |
| Deploy Producción | 0.5 días | Blue-green deploy |
| Monitoreo Post-Deploy | 1 día | Verificación |
| **Total** | **11-13 días** | Incluye ajustes |

---

## Riesgos y Mitigación

### Riesgo 1: Tests Incompletos
**Probabilidad**: Media
**Impacto**: Alto
**Mitigación**: Requerir test coverage thresholds en CI/CD, code reviews obligatorios

### Riesgo 2: Performance Issues en Producción
**Probabilidad**: Media
**Impacto**: Crítico
**Mitigación**: Performance testing riguroso, monitoreo en tiempo real, plan de rollback

### Riesgo 3: Problemas de Migración de Datos
**Probabilidad**: Baja
**Impacto**: Crítico
**Mitigación**: Migraciones reversibles, backups automáticos, rollback plan

### Riesgo 4: Downtime Durante Deploy
**Probabilidad**: Baja
**Impacto**: Alto
**Mitigación**: Blue-green deployment,零-downtime approach, rollback rápido

---

## Documentación de Soporte

### Para Operadores
- Guía de despliegue
- Procedimiento de emergencia
- Configuración de monitoreo
- Gestión de logs

### Para Desarrolladores
- Guía de desarrollo local
- Documentación de API completa
- Guía de testing
- Proceso de CI/CD

### Para Usuarios
- Guía de usuario
- FAQ
- Videos tutoriales
- Notas de versión

---

**Fecha de Creación**: 2026-06-09  
**Versión**: 1.0  
**Estado**: Plan aprobado para implementación