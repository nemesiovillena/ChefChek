# ChefChek - Deployment Guide

## Overview

ChefChek backend es una aplicación NestJS que usa Prisma ORM con PostgreSQL. Esta guía cubre el deployment en producción usando Docker y configuración de CI/CD.

## Tech Stack

- **Backend**: NestJS 10.x + TypeScript 5.x
- **Database**: PostgreSQL 14+
- **ORM**: Prisma 5.x
- **Authentication**: JWT (Lucia Auth pendiente)
- **API Documentation**: Swagger/OpenAPI 3.0
- **Deployment**: Docker + Docker Compose

---

## Prerequisites

### Development Environment

```bash
# Node.js 18+
node --version  # v18.0.0 or higher

# PostgreSQL 14+
psql --version  # 14.0 or higher

# Git
git --version   # 2.30+
```

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chefchek?schema=public"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="24h"

# Application
NODE_ENV="production"
PORT="3001"
API_PREFIX="/api"

# Optional: External Services
# REDIS_URL="redis://localhost:6379"
# SENTRY_DSN="https://your-sentry-dsn"
# SMTP_HOST="smtp.example.com"
# SMTP_PORT="587"
# SMTP_USER="user@example.com"
# SMTP_PASS="password"
```

---

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/your-org/chefchek.git
cd chefchek/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database with test data
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

API available at: http://localhost:3001
Swagger UI available at: http://localhost:3001/api/docs

### 6. Run Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

---

## Docker Deployment

### Docker Compose (Recommended for Production)

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: chefchek-postgres
    environment:
      POSTGRES_USER: chefchek
      POSTGRES_PASSWORD: chefchek_password
      POSTGRES_DB: chefchek
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - chefchek-network
    restart: unless-stopped

  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: chefchek-backend
    environment:
      DATABASE_URL: "postgresql://chefchek:chefchek_password@postgres:5432/chefchek?schema=public"
      JWT_SECRET: "${JWT_SECRET}"
      NODE_ENV: production
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    networks:
      - chefchek-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Redis Cache
  redis:
    image: redis:7-alpine
    container_name: chefchek-redis
    ports:
      - "6379:6379"
    networks:
      - chefchek-network
    restart: unless-stopped

  # Optional: Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: chefchek-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    networks:
      - chefchek-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  chefchek-network:
    driver: bridge
```

### Dockerfile

**File**: `Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Generate Prisma client in production
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "run", "start:prod"]
```

### Nginx Configuration (Optional)

**File**: `nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name api.chefchek.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.chefchek.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        # Swagger UI
        location /api/docs {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # API Endpoints
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Health check endpoint (bypass cache)
        location /health {
            proxy_pass http://backend;
            access_log off;
        }
    }
}
```

### Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check service status
docker-compose ps

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: chefchek/backend:latest
      
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/chefchek
            docker-compose pull
            docker-compose up -d
            docker image prune -f
```

### Required GitHub Secrets

Configure these secrets in repository settings:

- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password/token
- `PRODUCTION_HOST`: Production server IP/hostname
- `PRODUCTION_USER`: SSH username
- `SSH_PRIVATE_KEY`: Private SSH key
- `JWT_SECRET`: JWT secret for production

---

## Production Server Setup

### Initial Server Setup (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/chefchek
sudo chown $USER:$USER /opt/chefchek

# Clone repository
cd /opt/chefchek
git clone https://github.com/your-org/chefchek.git backend
cd backend

# Copy .env.production to .env
cp .env.production .env

# Edit configuration
nano .env

# Start services
docker-compose up -d
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

---

## Database Backup Strategies

### Automated Backups

**Cron Job** (add to crontab: `crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-chefchek.sh

# Weekly backup on Sundays at 3 AM
0 3 * * 0 /usr/local/bin/backup-chefchek-weekly.sh
```

**Backup Script**: `/usr/local/bin/backup-chefchek.sh`

```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/chefchek/backups"
RETENTION_DAYS=30

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Dump database
docker exec chefchek-postgres pg_dump -U chefchek chefchek > $BACKUP_DIR/chefchek_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/chefchek_$DATE.sql

# Remove backups older than retention period
find $BACKUP_DIR -name "chefchek_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup
echo "Backup completed: chefchek_$DATE.sql.gz" >> $BACKUP_DIR/backup.log
```

Make it executable:
```bash
chmod +x /usr/local/bin/backup-chefchek.sh
```

### Restore from Backup

```bash
# Stop backend
docker-compose stop backend

# Restore database
gunzip < /opt/chefchek/backups/chefchek_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i chefchek-postgres psql -U chefchek chefchek

# Start backend
docker-compose start backend
```

---

## Monitoring and Logging

### Application Logs

```bash
# View backend logs
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend

# View PostgreSQL logs
docker-compose logs -f postgres
```

### Health Checks

**Endpoint**: `GET /health`

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-06-02T10:00:00Z",
  "database": "connected",
  "version": "0.1.0"
}
```

### Log Aggregation (Optional)

**Install Loki + Grafana Stack**:

```yaml
# Add to docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

---

## Security Best Practices

### 1. Environment Variables

Never commit `.env` files. Use `.env.example` as template:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chefchek?schema=public"
JWT_SECRET="CHANGE_THIS_IN_PRODUCTION"
NODE_ENV="production"
PORT="3001"
```

### 2. Database Security

```sql
-- Create dedicated database user
CREATE USER chefchek_app WITH PASSWORD 'strong_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE chefchek TO chefchek_app;
GRANT USAGE ON SCHEMA public TO chefchek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chefchek_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO chefchek_app;

-- Alter default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chefchek_app;
```

### 3. Rate Limiting (Future)

Configure rate limits in NestJS guards:

```typescript
// src/guards/rate-limit.guard.ts
import { Injectable } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';

@Injectable()
export class RateLimitGuard {
  private rateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rate_limit',
    points: 100, // 100 requests
    duration: 60, // per 60 seconds
  });
}
```

### 4. CORS Configuration

Only allow trusted origins:

```typescript
app.enableCors({
  origin: [
    'https://chefchek.com',
    'https://app.chefchek.com',
  ],
  credentials: true,
});
```

---

## Scaling Considerations

### Horizontal Scaling

For horizontal scaling, use a load balancer:

```yaml
# docker-compose.yml (scaled version)
backend:
  image: chefchek/backend:latest
  deploy:
    replicas: 3
  environment:
    # Use external Redis for session storage
    REDIS_URL: "redis://redis:6379"
```

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_products_tenant_name ON products(tenant_id, name);
CREATE INDEX idx_recipes_tenant_slug ON recipes(tenant_id, slug);
CREATE INDEX idx_stock_tenant_product ON stock(tenant_id, product_id);

-- Enable query logging (development only)
ALTER SYSTEM SET log_min_duration_statement = 1000;
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Problem**: `Can't reach database server`

**Solution**:
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker exec -it chefchek-postgres psql -U chefchek -d chefchek
```

#### 2. Prisma Client Generation Failed

**Problem**: Error during `npx prisma generate`

**Solution**:
```bash
# Clear Prisma cache
rm -rf node_modules/.prisma

# Regenerate client
npx prisma generate
```

#### 3. Port Already in Use

**Problem**: `EADDRINUSE: address already in use`

**Solution**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

#### 4. Out of Memory

**Problem**: Container crashes due to OOM

**Solution**:
```yaml
# docker-compose.yml
backend:
  deploy:
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 256M
```

---

## Migration Guide

### Version Updates

When deploying a new version:

1. **Backup Database**:
   ```bash
   /usr/local/bin/backup-chefchek.sh
   ```

2. **Pull Latest Code**:
   ```bash
   cd /opt/chefchek/backend
   git pull origin main
   ```

3. **Run Migrations**:
   ```bash
   docker-compose exec backend npm run prisma:migrate
   ```

4. **Rebuild Containers**:
   ```bash
   docker-compose up -d --build
   ```

5. **Verify Deployment**:
   ```bash
   curl http://localhost:3001/health
   ```

---

## Appendix

### Useful Commands

```bash
# Database operations
docker-compose exec backend npm run prisma:studio  # Open Prisma Studio
docker-compose exec backend npm run prisma:migrate  # Run migrations
docker-compose exec backend npm run prisma:generate  # Generate client

# Docker operations
docker-compose ps                    # List services
docker-compose logs -f [service]     # View logs
docker-compose restart [service]     # Restart service
docker-compose down                  # Stop all services
docker-compose down -v               # Stop and remove volumes

# Prisma operations
npx prisma db pull                  # Pull schema changes from DB
npx prisma db push                  # Push schema to DB
npx prisma db seed                  # Seed database
npx prisma validate                 # Validate schema
```

### Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Documentation](https://docs.docker.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

**Version**: 0.1.0
**Last Updated**: 2026-06-02
**Author**: ChefChek Team