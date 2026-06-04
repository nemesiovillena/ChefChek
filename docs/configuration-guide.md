# Guía de Configuración - ChefChek

Guía completa de configuración para despliegue de ChefChek en diferentes entornos.

## Tabla de Contenidos

1. [Variables de Entorno](#variables-de-entorno)
2. [Plantillas .env](#plantillas-env)
3. [Configuración de Base de Datos](#configuración-de-base-de-datos)
4. [Requisitos de VPS](#requisitos-de-vps)
5. [Dependencias Externas](#dependencias-externas)
6. [Configuración Docker](#configuración-docker)

---

## Variables de Entorno

### Base de Datos

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `DATABASE_URL` | string | - | ✅ Sí | URL de conexión PostgreSQL con schema | `postgresql://chefchek:password@localhost:5432/chefchek?schema=public` |
| `REDIS_URL` | string | - | ⚠️ Opcional | URL de Redis para caché y colas | `redis://localhost:6379` |

### Autenticación

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `JWT_SECRET` | string | - | ✅ Sí | **⚠️ CAMBIAR EN PRODUCCIÓN** - Secreto para firmar tokens JWT (mínimo 32 caracteres) | `your-super-secure-jwt-secret-key-minimum-32-chars` |
| `JWT_EXPIRES_IN` | string | `24h` | No | Tiempo de expiración del token JWT | `1d`, `12h`, `7d` |

### Aplicación

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `NODE_ENV` | string | `development` | No | Entorno de ejecución | `development`, `production`, `staging` |
| `PORT` | number | `3001` | No | Puerto del servidor backend | `3001` |
| `API_PREFIX` | string | `/api` | No | Prefijo de rutas API | `/api`, `/v1` |
| `FRONTEND_URL` | string | - | ✅ Sí | URL del frontend para CORS | `http://localhost:3000` |
| `APP_NAME` | string | `ChefChek` | No | Nombre de la aplicación | `ChefChek` |
| `APP_URL` | string | - | ✅ Sí | URL base de la aplicación | `https://chefchek.com` |
| `LOG_LEVEL` | string | `info` | No | Nivel de logging | `error`, `warn`, `info`, `debug` |

### CORS

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `ALLOWED_ORIGINS` | string | - | ✅ Sí | **⚠️ CAMBIAR EN PRODUCCIÓN** - Orígenes permitidos separados por coma | `https://chefchek.com,https://app.chefchek.com` |

### Servicios Externos

#### Telegram Bot (Opcional)

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | string | - | ⚠️ Opcional | Token del bot de Telegram para ingesta de documentos | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |

#### OCR Service (Opcional)

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `OCR_API_KEY` | string | - | ⚠️ Opcional | API key para servicio OCR (Tesseract.js es gratuito por defecto) | `your-ocr-api-key` |

#### Sentry - Error Tracking (Opcional)

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `SENTRY_DSN` | string | - | ⚠️ Opcional | DSN de Sentry para tracking de errores | `https://examplePublicKey@o0.ingest.sentry.io/0` |

#### SMTP - Email (Opcional)

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `SMTP_HOST` | string | - | ⚠️ Opcional | Host del servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | number | `587` | No | Puerto del servidor SMTP | `587`, `465` |
| `SMTP_USER` | string | - | ⚠️ Opcional | Usuario de autenticación SMTP | `notifications@chefchek.com` |
| `SMTP_PASS` | string | - | ⚠️ Opcional | **⚠️ CAMBIAR EN PRODUCCIÓN** - Contraseña SMTP | `your-smtp-password` |

### Límites de Archivo

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `MAX_FILE_SIZE_MB` | number | `10` | No | Tamaño máximo de subida de archivos en MB | `10`, `20`, `50` |

### Configuración de Producción

| Variable | Tipo | Default | Requerido | Descripción | Ejemplo |
|----------|------|---------|-----------|-------------|---------|
| `RATE_LIMIT_MAX` | number | `100` | No | Máximo de requests por ventana de rate limiting | `100` |
| `RATE_LIMIT_WINDOW_MS` | number | `60000` | No | Ventana de tiempo para rate limiting en ms | `60000` (1 minuto) |

---

## Plantillas .env

### Desarrollo (.env.dev)

```bash
# ============================================
# CHEFCHEK - DESARROLLO
# ============================================

# Base de Datos
DATABASE_URL="postgresql://chefchek:chefchek_dev@localhost:5432/chefchek_dev?schema=public"

# Redis (opcional, para caché)
REDIS_URL="redis://localhost:6379"

# JWT Authentication
JWT_SECRET="dev-secret-key-change-in-production-32-chars-minimum"
JWT_EXPIRES_IN="7d"

# Aplicación
NODE_ENV="development"
PORT="3001"
API_PREFIX="/api"
FRONTEND_URL="http://localhost:3000"
APP_NAME="ChefChek"
APP_URL="http://localhost:3000"
LOG_LEVEL="debug"

# CORS
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Telegram Bot (opcional)
TELEGRAM_BOT_TOKEN=""

# OCR (opcional)
OCR_API_KEY=""

# Sentry (opcional)
SENTRY_DSN=""

# SMTP (opcional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# Límites de archivo
MAX_FILE_SIZE_MB="10"

# Rate Limiting (desactivado en desarrollo)
RATE_LIMIT_MAX="1000"
RATE_LIMIT_WINDOW_MS="60000"
```

### Staging (.env.staging)

```bash
# ============================================
# CHEFCHEK - STAGING
# ============================================

# Base de Datos
DATABASE_URL="postgresql://chefchek_staging:CHANGE_THIS_PASSWORD@postgres-staging:5432/chefchek_staging?schema=public"

# Redis
REDIS_URL="redis://redis-staging:6379"

# JWT Authentication
# ⚠️ CAMBIAR ESTE SECRETO EN PRODUCCIÓN
JWT_SECRET="CHANGE_THIS_TO_SECURE_32_CHAR_SECRET_IN_STAGING"
JWT_EXPIRES_IN="24h"

# Aplicación
NODE_ENV="staging"
PORT="3001"
API_PREFIX="/api"
FRONTEND_URL="https://staging.chefchek.com"
APP_NAME="ChefChek Staging"
APP_URL="https://staging.chefchek.com"
LOG_LEVEL="info"

# CORS
# ⚠️ CAMBIAR EN PRODUCCIÓN - Solo dominios de staging
ALLOWED_ORIGINS="https://staging.chefchek.com,https://app-staging.chefchek.com"

# Telegram Bot (opcional)
TELEGRAM_BOT_TOKEN=""

# OCR (opcional)
OCR_API_KEY=""

# Sentry (recomendado en staging)
SENTRY_DSN=""

# SMTP (opcional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# Límites de archivo
MAX_FILE_SIZE_MB="10"

# Rate Limiting
RATE_LIMIT_MAX="200"
RATE_LIMIT_WINDOW_MS="60000"
```

### Producción (.env.prod)

```bash
# ============================================
# CHEFCHEK - PRODUCCIÓN
# ============================================

# ⚠️ ADVERTENCIA: Las variables marcadas con CAMBIAR deben modificarse
# antes de desplegar en producción.

# Base de Datos
# ⚠️ CAMBIAR: Contraseña de base de datos
DATABASE_URL="postgresql://chefchek_prod:STRONG_SECURE_PASSWORD_HERE@postgres-prod:5432/chefchek_prod?schema=public"

# Redis
# ⚠️ CAMBIAR: Usar Redis con contraseña si es posible
REDIS_URL="redis://:redis_password_here@redis-prod:6379"

# JWT Authentication
# ⚠️ CAMBIAR: Generar nuevo secreto de mínimo 32 caracteres con caracteres aleatorios
# Comando: openssl rand -base64 32
JWT_SECRET="CHANGE_THIS_TO_SECURE_32_CHAR_SECRET_MINIMUM_IN_PRODUCTION_USE_OPENSSL_RAND_BASE64_32"
JWT_EXPIRES_IN="24h"

# Aplicación
NODE_ENV="production"
PORT="3001"
API_PREFIX="/api"
FRONTEND_URL="https://chefchek.com"
APP_NAME="ChefChek"
APP_URL="https://chefchek.com"
LOG_LEVEL="error"

# CORS
# ⚠️ CAMBIAR: Solo incluir dominios de producción
ALLOWED_ORIGINS="https://chefchek.com,https://app.chefchek.com,https://api.chefchek.com"

# Telegram Bot (opcional)
TELEGRAM_BOT_TOKEN=""

# OCR (opcional)
OCR_API_KEY=""

# Sentry (recomendado en producción)
# ⚠️ CAMBIAR: Usar DSN real de Sentry
SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"

# SMTP (opcional)
# ⚠️ CAMBIAR: Configurar servidor SMTP real
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="notifications@chefchek.com"
SMTP_PASS="CHANGE_THIS_SMTP_PASSWORD"

# Límites de archivo
MAX_FILE_SIZE_MB="10"

# Rate Limiting
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW_MS="60000"
```

---

## Configuración de Base de Datos

### Requisitos de PostgreSQL

ChefChek utiliza PostgreSQL 14+ con las siguientes características:

**Versión Mínima:** PostgreSQL 14  
**Versión Recomendada:** PostgreSQL 16

**Extensiones Requeridas:**  
- Ninguna extensión especial requerida

**Configuraciones Recomendadas:**

```ini
# postgresql.conf
shared_buffers = 256MB          # 25% de RAM en VPS con 1GB
effective_cache_size = 1GB      # 50-75% de RAM total
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1          # SSD
effective_io_concurrency = 200 # SSD
work_mem = 2621kB               # basado en conexiones concurrentes
min_wal_size = 1GB
max_wal_size = 4GB
```

### Formato de Connection String

```bash
# Formato estándar
postgresql://usuario:password@host:puerto/database?schema=public

# Ejemplos
postgresql://chefchek:secure_pass@localhost:5432/chefchek?schema=public
postgresql://chefchek:secure_pass@postgres-production:5432/chefchek?schema=public

# Con SSL (recomendado en producción)
postgresql://chefchek:secure_pass@host:5432/chefchek?schema=public&sslmode=require
```

### Configuración Prisma

ChefChek usa Prisma ORM. Configuración en `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Comandos de Migración

```bash
# Generar cliente Prisma
npm run prisma:generate

# Aplicar migraciones en desarrollo
npm run prisma:migrate

# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Resetear base de datos (⚠️ elimina datos)
npx prisma migrate reset

# Ver base de datos con Prisma Studio
npm run prisma:studio
```

### Connection Pooling

**Pool de Conexiones (Recomendado):**

```javascript
// src/prisma.service.ts
{
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  connectionLimit: 10,  // Ajustar según carga
}
```

**Configuración de Pooling por Entorno:**

| Entorno | Conexiones Máximas | Conexiones Mínimas | Timeout |
|---------|-------------------|-------------------|---------|
| Desarrollo | 5 | 1 | 30s |
| Staging | 10 | 2 | 30s |
| Producción | 20 | 5 | 20s |

### Permisos de Usuario de Base de Datos

**Usuario Mínimo (Recomendado para Aplicación):**

```sql
-- Crear usuario con permisos mínimos
CREATE USER chefchek_app WITH PASSWORD 'secure_password';

-- Dar permisos específicos
GRANT CONNECT ON DATABASE chefchek TO chefchek_app;
GRANT USAGE ON SCHEMA public TO chefchek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chefchek_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO chefchek_app;

-- Dar permisos a tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chefchek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO chefchek_app;
```

**Usuario Administrativo (Solo para Migraciones):**

```sql
-- Crear usuario admin
CREATE USER chefchek_admin WITH PASSWORD 'strong_admin_password';

-- Dar todos los permisos
GRANT ALL PRIVILEGES ON DATABASE chefchek TO chefchek_admin;
GRANT ALL ON SCHEMA public TO chefchek_admin;
```

---

## Requisitos de VPS

### Especificaciones Mínimas

**CPU:** 2 vCPU  
**RAM:** 4GB  
**Almacenamiento:** 40GB SSD  
**Ancho de Banda:** 10 Mbps

**Adecuado para:**
- Desarrollo y testing
- 10-20 usuarios concurrentes
- Pequeñas operaciones

### Especificaciones Recomendadas

**CPU:** 4 vCPU  
**RAM:** 8GB  
**Almacenamiento:** 80GB SSD  
**Ancho de Banda:** 25 Mbps

**Adecuado para:**
- Producción
- 50-100 usuarios concurrentes
- Operaciones medianas

### Cálculo de Almacenamiento

**Base de Datos + Logs + Backups:**

| Componente | Espacio Estimado | Notas |
|-----------|------------------|-------|
| PostgreSQL (DB) | 5-10 GB | 1000 productos, 1000 recetas, 1 año de datos |
| PostgreSQL (WAL) | 2-5 GB | Logs transaccionales |
| Backups DB | 15-30 GB | 3 copias de retención (daily + 2 weekly) |
| Logs de Aplicación | 2-5 GB | 30 días de retención |
| Archivos Subidos | 5-10 GB | Documentos, facturas, etc. |
| **Total** | **29-60 GB** | Margen recomendado: +40% |

**Recomendación de Storage:**
- Desarrollo: 40GB SSD
- Staging: 60GB SSD
- Producción: 80-120GB SSD

### Requisitos de Red

**Puertos Requeridos:**

| Puerto | Protocolo | Uso | Nota |
|--------|-----------|-----|------|
| 80 | TCP | HTTP | Redirigir a 443 |
| 443 | TCP | HTTPS | Frontend + Backend |
| 22 | TCP | SSH | Acceso administrativo |
| 5432 | TCP | PostgreSQL | Local only (no exponer) |
| 6379 | TCP | Redis | Local only (no exponer) |

**Firewall Configuración (UFW):**

```bash
# Permitir HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir SSH
sudo ufw allow 22/tcp

# Denegar puertos de bases de datos externamente
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Activar firewall
sudo ufw enable
```

### Requisitos del Sistema Operativo

**Sistemas Soportados:**

- Ubuntu 22.04 LTS (recomendado)
- Ubuntu 24.04 LTS
- Debian 12+
- AlmaLinux 9 / Rocky Linux 9

**Paquetes del Sistema Requeridos:**

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y \
  curl \
  wget \
  git \
  build-essential \
  pkg-config \
  libpq-dev \
  ufw \
  nginx \
  certbot \
  python3-certbot-nginx

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

---

## Dependencias Externas

### Node.js

**Versión Requerida:** Node.js 18+ (LTS recomendado)  
**Gestor de Paquetes:** npm o pnpm

**Instalación (Ubuntu):**

```bash
# Usar NodeSource (recomendado)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### PostgreSQL

**Versión Requerida:** PostgreSQL 14+  
**Recomendado:** PostgreSQL 16

**Instalación (Ubuntu 22.04):**

```bash
# Agregar repositorio PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar versión
psql --version
```

**Instalación via Docker (Recomendado):**

```bash
docker run -d \
  --name chefchek-postgres \
  -e POSTGRES_USER=chefchek \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=chefchek \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Redis

**Versión Requerida:** Redis 7+  
**Uso:** Caché y colas (Bull)

**Instalación (Ubuntu):**

```bash
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verificar
redis-cli ping
```

**Instalación via Docker (Recomendado):**

```bash
docker run -d \
  --name chefchek-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine
```

### Docker + Docker Compose

**Versión Requerida:** Docker 24+ / Docker Compose 2.20+

**Instalación:**

```bash
# Script oficial de Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verificar instalación
docker --version
docker compose version

# Añadir usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### Nginx

**Versión Recomendada:** 1.24+  
**Uso:** Reverse proxy y terminación SSL

**Instalación:**

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Configuración Básica:**

```nginx
# /etc/nginx/sites-available/chefchek
upstream backend {
    server localhost:3001;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name chefchek.com www.chefchek.com;

    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chefchek.com www.chefchek.com;

    # Certificados SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/chefchek.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chefchek.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Certificados SSL (Let's Encrypt)

**Obtener Certificados:**

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d chefchek.com -d www.chefchek.com

# Renovación automática (configurada por defecto)
sudo certbot renew --dry-run
```

---

## Configuración Docker

### Docker Compose

**Estructura de Servicios:**

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: chefchek-postgres
    environment:
      POSTGRES_USER: chefchek
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: chefchek
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - chefchek-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chefchek"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: chefchek-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - chefchek-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: chefchek-backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - chefchek-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:3001/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend (Next.js)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: chefchek-frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - chefchek-network
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: chefchek-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    networks:
      - chefchek-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  chefchek-network:
    driver: bridge
```

### Límites de Recursos de Contenedor

**Configuración Recomendada (VPS 4 vCPU, 8GB RAM):**

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M

  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M

  nginx:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M
```

### Montaje de Volúmenes

**Volúmenes Persistentes:**

```yaml
volumes:
  # Base de datos
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/chefchek/postgres

  # Redis
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/chefchek/redis

  # Archivos subidos
  uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/chefchek/uploads
```

**Crear directorios antes de desplegar:**

```bash
sudo mkdir -p /var/lib/chefchek/{postgres,redis,uploads}
sudo chown -R $USER:$USER /var/lib/chefchek
chmod 755 /var/lib/chefchek
```

### Configuración de Red

**Red Docker Bridge:**

```yaml
networks:
  chefchek-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Variables de Entorno para Red:**

```bash
# .env
# Backend
DATABASE_URL="postgresql://chefchek:password@postgres:5432/chefchek?schema=public"
REDIS_URL="redis://redis:6379"

# Frontend
NEXT_PUBLIC_API_URL="https://api.chefchek.com"
```

---

## Comandos de Despliegue

### Desarrollo

```bash
# Instalar dependencias
npm install

# Configurar base de datos
npm run prisma:generate
npm run prisma:migrate

# Iniciar servidor
npm run start:dev
```

### Producción

```bash
# Construir imágenes Docker
docker compose build

# Iniciar servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Verificar salud de servicios
docker compose ps

# Aplicar migraciones
docker compose exec backend npx prisma migrate deploy

# Reiniciar servicios
docker compose restart
```

### Monitoreo

```bash
# Ver recursos de contenedores
docker stats

# Ver logs de servicio específico
docker compose logs -f backend
docker compose logs -f postgres

# Entrar en contenedor
docker compose exec backend bash
docker compose exec postgres psql -U chefchek -d chefchek
```

---

## Seguridad en Producción

### ⚠️ Variables que DEBEN Cambiarse

**CRÍTICO - Cambiar obligatoriamente:**

1. `JWT_SECRET` - Generar nuevo secreto de 32+ caracteres
2. `DATABASE_URL` - Contraseña de base de datos
3. `ALLOWED_ORIGINS` - Solo dominios de producción
4. `SMTP_PASS` - Contraseña de SMTP

**Generar JWT_SECRET seguro:**

```bash
# OpenSSL
openssl rand -base64 32

# O con Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Configuraciones de Seguridad Adicionales

```bash
# Permisos de archivo
chmod 600 .env
chmod 700 logs/

# Firewall
sudo ufw enable
sudo ufw status

# SSL/TLS
sudo certbot renew --dry-run

# Actualizaciones automáticas de seguridad
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Solución de Problemas

### Base de Datos No Conecta

```bash
# Verificar PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -U chefchek -h localhost -d chefchek

# Verificar firewall
sudo ufw status
```

### Error de Permiso en .env

```bash
# Cambiar permisos
chmod 600 .env
chown $USER:$USER .env

# Verificar variables
cat .env
```

### Contenedores No Inician

```bash
# Ver logs de Docker
docker compose logs

# Reconstruir imágenes
docker compose build --no-cache

# Verificar healthchecks
docker inspect chefchek-postgres | grep -A 10 Health
```

---

## Referencias

- [Documentación Prisma](https://www.prisma.io/docs)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)

---

**Última actualización:** 2026-06-03  
**Versión:** 1.0.0
