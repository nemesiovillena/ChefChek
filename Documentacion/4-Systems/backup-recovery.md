# Guía de Backup y Recuperación - ChefChek

## Estrategia de Backups PostgreSQL

### Visión General

ChefChek implementa una estrategia de backup de tres niveles para garantizar la seguridad de los datos:

```
┌─────────────────────────────────────────────────────────────┐
│                  ESTRATEGIA DE BACKUPS                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Diaria (Incremental)     → 02:00 AM        → Retención 30d │
│  Semanal (Full)           → Domingo 03:00 AM→ Retención 12s │
│  Mensual (Archivo)        → 1° del mes 04:00→ Retención 12m │
│                                                              │
│  Formatos:                                                 │
│  - pg_dump (custom format) - Flexibilidad                  │
│  - pg_basebackup (physical) - Réplica completa             │
│  - Filesystem snapshots - Instantáneas de volumen          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Backup

#### 1. **pg_dump (Backup Lógico)**
- **Formato**: Custom (`-Fc`) - Permite restauración selectiva
- **Ventajas**: Portabilidad, compresión nativa, restauración granular
- **Uso**: Backups diarios y migraciones
- **Comando**: `pg_dump -Fc -f backup.dump chefchek_db`

#### 2. **pg_basebackup (Backup Físico)**
- **Formato**: Réplica binaria completa del cluster
- **Ventajas**: Restauración rápida, incluye WALs
- **Uso**: Backups semanales y standby servers
- **Comando**: `pg_basebackup -D /backup/dir -Ft -z`

#### 3. **Filesystem Snapshots**
- **Formato**: Instantáneas de volumen Docker
- **Ventajas**: Consistencia instantánea, cero downtime
- **Uso**: Pre-mantenimiento, rollback rápido
- **Comando**: `docker volume create --driver local ...`

### Ubicaciones de Almacenamiento

#### Local (Primaria)
```
/var/backups/chefchek/
├── daily/      # Backups diarios (30 días)
├── weekly/     # Backups semanales (12 semanas)
├── monthly/    # Backups mensuales (12 meses)
└── checksums/  # Sumas de verificación MD5/SHA256
```

#### Remota Opcional (S3/B2)
```
s3://chefchek-backups/
├── prod/
│   ├── daily/
│   ├── weekly/
│   └── monthly/
└── logs/
```

### Convención de Nomenclatura

```
Formato: chefchek_{tipo}_{YYYYMMDD}_{HHMMSS}.{ext}

Ejemplos:
- chefchek_daily_20250603_020000.dump.gz
- chefchek_weekly_20250602_030000.tar.gz
- chefchek_monthly_20250601_040000.dump.gz

Checksums:
- chefchek_daily_20250603_020000.dump.gz.md5
- chefchek_daily_20250603_020000.dump.gz.sha256
```

### Clasificación de Datos

| Categoría | Descripción | Frecuencia | Retención |
|-----------|-------------|------------|-----------|
| **Database** | PostgreSQL data (todos los schemas) | Diaria | 30d/12s/12m |
| **Uploads** | Archivos subidos (imágenes, documentos) | Semanal | 12s/12m |
| **Configs** | Archivos de configuración app + DB | Mensual | 12m |
| **Env Vars** | Variables de entorno (Dokploy) | Manual | 12m |
| **WALs** | PostgreSQL Write-Ahead Logs | Continuo | 30d |

### Objetivos de Recuperación

#### RPO (Recovery Point Objective)
- **Máxima pérdida de datos aceptable**: 24 horas
- **Implementación**: Backup diario + WAL archiving
- **Nota**: Con WAL archiving, RPO real puede ser ~minutes

#### RTO (Recovery Time Objective)
- **Tiempo máximo de downtime**: 2 horas
- **Desglose**:
  - Restauración backup: 30-45 min
  - Verificación datos: 15-30 min
  - Testing funcional: 30-45 min
  - Switchover: 15-30 min

---

## Scripts de Backup Automáticos

### backup.sh

Script principal de backup automatizado con soporte para Docker y PostgreSQL directo.

#### Características

- ✅ Formato custom pg_dump (`-Fc`) para máxima flexibilidad
- ✅ Compresión gzip automática
- ✅ Generación de checksums (MD5 + SHA256)
- ✅ Rotación automática (30d/12s/12m)
- ✅ Upload a S3 (opcional, configurable)
- ✅ Notificaciones por email/slack
- ✅ Logging completo a `/var/log/chefchek-backup.log`
- ✅ Modo dry-run para testing
- ✅ Pre-backup checks (espacio disco, conectividad DB)
- ✅ Post-backup verification (tamaño archivo, checksum)
- ✅ Soporte Docker (`docker exec`)

#### Uso Básico

```bash
# Ejecutar backup completo
./scripts/backup.sh

# Backup en modo dry-run (no modifica archivos)
./scripts/backup.sh --dry-run

# Backup solo base de datos (sin uploads)
./scripts/backup.sh --db-only

# Backup con verbosidad detallada
./scripts/backup.sh --verbose

# Backup con configuración personalizada
CONFIG_FILE=/etc/chefchek/backup.conf ./scripts/backup.sh
```

#### Variables de Entorno

```bash
# PostgreSQL
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-chefchek}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

# Docker (opcional)
DOCKER_CONTAINER=${DOCKER_CONTAINER:-chefchek-postgres-1}
USE_DOCKER=${USE_DOCKER:-false}

# Retención
RETENTION_DAILY=${RETENTION_DAILY:-30}
RETENTION_WEEKLY=${RETENTION_WEEKLY:-12}
RETENTION_MONTHLY=${RETENTION_MONTHLY:-12}

# Almacenamiento
BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/chefchek}
UPLOAD_S3=${UPLOAD_S3:-false}
S3_BUCKET=${S3_BUCKET:-s3://chefchek-backups}

# Notificaciones
NOTIFY_EMAIL=${NOTIFY_EMAIL:-admin@chefchek.com}
NOTIFY_SLACK=${NOTIFY_SLACK:-false}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-}

# Logging
LOG_FILE=${LOG_FILE:-/var/log/chefchek-backup.log}
LOG_LEVEL=${LOG_LEVEL:-INFO}
```

#### Flujo de Ejecución

```
1. PRE-CHECKS
   ├── Validar espacio disco (mínimo 5GB libre)
   ├── Verificar conectividad PostgreSQL
   ├── Crear directorios de backup
   └── Verificar permisos escritura

2. BACKUP DATABASE
   ├── pg_dump -Fc (custom format)
   ├── Compresión gzip
   ├── Generar checksums (MD5 + SHA256)
   └── Validar archivo resultado

3. BACKUP FILES (opcional)
   ├── Docker volumes
   ├── Uploads directory
   └── Configuration files

4. ROTATION
   ├── Eliminar backups antiguos (diarios > 30d)
   ├── Eliminar backups antiguos (semanales > 12s)
   └── Eliminar backups antiguos (mensuales > 12m)

5. UPLOAD REMOTO (opcional)
   ├── Upload a S3/B2
   └── Verificar upload exitoso

6. NOTIFICACIÓN
   ├── Email resumen backup
   └── Slack alerta (si falla)

7. POST-CHECKS
   ├── Verificar tamaño backup (> mínimo esperado)
   ├── Validar checksum
   └── Limpiar archivos temporales
```

### restore.sh

Script de restauración con verificaciones de seguridad y recuperación granular.

#### Características

- ✅ Point-in-time recovery (PITR)
- ✅ Selección de backup específico
- ✅ Pre-restore safety checks
- ✅ Backup automático pre-restauración
- ✅ Prisma migrate post-restore
- ✅ Health check post-restauración
- ✅ Modo dry-run
- ✅ Restauración selectiva (tabla/schema)
- ✅ Rollback automático si falla

#### Uso Básico

```bash
# Listar backups disponibles
./scripts/restore.sh --list

# Restaurar backup más reciente
./scripts/restore.sh --latest

# Restaurar backup específico
./scripts/restore.sh --backup chefchek_daily_20250603_020000.dump.gz

# Restaurar solo tabla específica
./scripts/restore.sh --backup backup.dump.gz --table users

# Restaurar a punto en el tiempo específico
./scripts/restore.sh --backup backup.dump.gz --pitr "2025-06-03 14:30:00"

# Modo dry-run (simula restauración)
./scripts/restore.sh --backup backup.dump.gz --dry-run

# Restaurar con skip de errors
./scripts/restore.sh --backup backup.dump.gz --skip-errors
```

#### Flujo de Ejecución

```
1. PRE-RESTORE CHECKS
   ├── Verificar backup existe
   ├── Validar checksum backup
   ├── Verificar espacio disco
   ├── Chequear conectividad PostgreSQL
   └── Crear backup pre-restauración

2. PREPARACIÓN
   ├── Detener aplicaciones conectadas
   ├── Dropear base de datos existente
   └── Crear base de datos vacía

3. RESTAURACIÓN
   ├── pg_restore (custom format)
   ├── Aplicar migrations de Prisma
   ├── Validar estructura datos
   └── Verificar integridad referencial

4. POST-RESTORE
   ├── Reiniciar aplicaciones
   ├── Ejecutar health checks
   ├── Verificar conectividad
   └── Limpiar archivos temporales

5. VERIFICACIÓN
   ├── Check schema integrity
   ├── Validar datos críticos
   ├── Testear endpoints API
   └── Generar reporte restauración
```

---

## Procedimientos de Disaster Recovery

### Escenario 1: Corrupción de Datos (Tabla Individual)

**Síntoma**: Una tabla específica presenta datos inconsistentes o corruptos.

**Tiempo Estimado**: 30-45 minutos

**Pasos**:

1. **Identificar tabla afectada**
   ```bash
   # Verificar errores en logs
   tail -f /var/log/chefchek-app.log | grep -i error
   
   # Identificar tabla problemática
   psql -c "SELECT relname FROM pg_class WHERE relkind = 'r' ORDER BY relname;"
   ```

2. **Aislar tabla**
   ```bash
   # Bloquear escrituras en tabla
   psql -c "LOCK TABLE problematic_table IN ACCESS EXCLUSIVE MODE;"
   
   # Renombrar tabla afectada
   psql -c "ALTER TABLE problematic_table RENAME TO problematic_table_corrupted_$(date +%Y%m%d);"
   ```

3. **Restaurar tabla desde backup**
   ```bash
   ./scripts/restore.sh \
     --backup chefchek_daily_20250603_020000.dump.gz \
     --table problematic_table \
     --verbose
   ```

4. **Verificar datos restaurados**
   ```bash
   # Check row count
   psql -c "SELECT COUNT(*) FROM problematic_table;"
   
   # Verificar datos críticos
   psql -c "SELECT * FROM problematic_table WHERE created_at > NOW() - INTERVAL '1 day' LIMIT 10;"
   ```

5. **Eliminar tabla corrupta**
   ```bash
   psql -c "DROP TABLE problematic_table_corrupted_20250603;"
   ```

**Contacto**: Admin DB + Team Lead

---

### Escenario 2: Falla del Servidor Database (Restauración Completa)

**Síntoma**: Servidor PostgreSQL no responde o está corrupto.

**Tiempo Estimado**: 1-2 horas

**Pasos**:

1. **Diagnosticar falla**
   ```bash
   # Verificar estado PostgreSQL
   systemctl status postgresql
   docker ps -a | grep postgres
   
   # Revisar logs error
   tail -100 /var/log/postgresql/postgresql-14-main.log
   ```

2. **Provisionar nuevo servidor**
   - Iniciar nueva instancia VPS (Hostinger)
   - Instalar Docker + Dokploy
   - Configurar networking/firewall

3. **Restaurar backup más reciente**
   ```bash
   # Copiar backup desde S3/local storage
   aws s3 cp s3://chefchek-backups/prod/latest/chefchek_daily_YYYYMMDD_HHMMSS.dump.gz ./
   
   # Ejecutar restauración completa
   ./scripts/restore.sh \
     --backup chefchek_daily_YYYYMMDD_HHMMSS.dump.gz \
     --full \
     --verbose
   ```

4. **Configurar PostgreSQL**
   ```bash
   # Ajustar configuración PostgreSQL
   vi /etc/postgresql/14/main/postgresql.conf
   
   # Reiniciar PostgreSQL
   systemctl restart postgresql
   ```

5. **Verificar restauración**
   ```bash
   # Ejecutar health checks
   curl http://localhost:3000/health
   psql -c "SELECT COUNT(*) FROM users;"
   psql -c "SELECT COUNT(*) FROM orders;"
   ```

6. **Actualizar DNS/Application**
   - Actualizar connection strings
   - Re-desplegar aplicaciones
   - Monitorear logs

**Contacto**: DevOps + System Admin + Team Lead

---

### Escenario 3: Eliminación Accidental (PITR)

**Síntoma**: Datos eliminados erróneamente (DROP TABLE, DELETE sin WHERE).

**Tiempo Estimado**: 45-60 minutos

**Pasos**:

1. **Identificar momento de eliminación**
   ```bash
   # Revisar logs de aplicación
   grep -i "drop table\|delete from" /var/log/chefchek-app.log
   
   # Identificar timestamp exacto
   date -d "2025-06-03 14:30:00"
   ```

2. **Detener aplicaciones inmediatamente**
   ```bash
   # Detener app para evitar más cambios
   docker-compose stop app
   docker stop chefchek-backend-1
   ```

3. **Recuperar usando PITR**
   ```bash
   # Restaurar a punto en el tiempo
   ./scripts/restore.sh \
     --backup chefchek_daily_20250603_020000.dump.gz \
     --pitr "2025-06-03 14:25:00" \
     --verbose
   ```

4. **Verificar datos recuperados**
   ```bash
   # Confirmar datos existen
   psql -c "SELECT COUNT(*) FROM accidentally_dropped_table;"
   
   # Verificar datos pre-eliminación
   psql -c "SELECT * FROM accidentally_dropped_table WHERE deleted_at IS NULL;"
   ```

5. **Reiniciar aplicaciones**
   ```bash
   docker-compose start app
   docker start chefchek-backend-1
   ```

**Contacto**: Team Lead + Admin DB

---

### Escenario 4: Ransomware (Restauración Offline)

**Síntoma**: Datos encriptados por ransomware, sistema comprometido.

**Tiempo Estimado**: 2-4 horas

**Pasos**:

1. **ISOLAR SISTEMA COMPROMETIDO**
   ```bash
   # Desconectar red inmediatamente
   ifconfig eth0 down
   # Apagar servidor
   shutdown -h now
   ```

2. **Provisionar nuevo ambiente limpio**
   - New VPS (clean install)
   - Fresh Docker + Dokploy
   - New passwords/credentials
   - Actualizar SSH keys

3. **Restaurar desde backup offline**
   ```bash
   # Descargar backup desde S3 (offline)
   aws s3 cp --recursive s3://chefchek-backups/prod/ /tmp/backups/
   
   # Verificar integridad backup
   md5sum -c checksums/*.md5
   
   # Restaurar en sistema limpio
   ./scripts/restore.sh \
     --backup /tmp/backups/chefchek_daily_PRE_RANSOMWARE.dump.gz \
     --full \
     --skip-errors \
     --verbose
   ```

4. **Escanear datos restaurados**
   ```bash
   # ClamAV scan
   clamscan -r /var/lib/postgresql/14/main/
   
   # Verificar no hay archivos sospechosos
   find /var/backups/chefchek -type f -name "*.enc" -o -name "*.locked"
   ```

5. **Investigar vector de infección**
   - Audit logs SSH
   - Revisar logs aplicación
   - Identificar vulnerabilidad explotada

6. **Endurecer seguridad**
   - Actualizar todos los sistemas
   - Rotar todas las credenciales
   - Implementar 2FA
   - Configurar WAF

**Contacto**: CISO + Security Team + Management + Legal

---

### Escenario 5: Outage Regional (Failover)

**Síntoma**: Data center completo offline (red, power, disaster natural).

**Tiempo Estimado**: 2-3 horas

**Pasos**:

1. **Declarar disaster**
   - Confirmar outage regional
   - Activar equipo response
   - Comunicar stakeholders

2. **Activar standby region**
   ```bash
   # Iniciar standby server (backup region)
   aws ec2 start-instances --instance-ids i-standby-db
   
   # Verificar replicación PostgreSQL
   psql -h standby-db-host -c "SELECT pg_is_in_recovery();"
   ```

3. **Promover standby a primary**
   ```bash
   # Detener replicación
   psql -h standby-db-host -c "SELECT pg_promote();"
   
   # Actualizar connection strings apps
   export DATABASE_URL="postgresql://user:pass@standby-db-host:5432/chefchek"
   
   # Re-deployar apps
   dokploy deploy --force
   ```

4. **Verificar funcionamiento**
   ```bash
   # Health checks
   curl https://chefchek.com/health
   curl https://api.chefchek.com/health
   
   # Monitorear logs
   tail -f /var/log/chefchek-app.log
   ```

5. **DNS failover**
   ```bash
   # Actualizar DNS records
   # Usar Route53/Cloudflare DNS failover
   # TTL reducido previo
   ```

**Contacto**: DevOps + Management + Support Team + Customers

---

## Configuración de Cron Jobs

### Crontab para Backup Automatizado

```bash
# Editar crontab
crontab -e

# Agregar las siguientes entradas:

# ==============================
# BACKUPS CHEFCHEK
# ==============================

# Backup diario (cada día a las 02:00)
0 2 * * * /path/to/chefchek/backend/scripts/backup.sh --type daily >> /var/log/chefchek-backup.log 2>&1

# Backup semanal (domingos a las 03:00)
0 3 * * 0 /path/to/chefchek/backend/scripts/backup.sh --type weekly >> /var/log/chefchek-backup.log 2>&1

# Backup mensual (1° del mes a las 04:00)
0 4 1 * * /path/to/chefchek/backend/scripts/backup.sh --type monthly >> /var/log/chefchek-backup.log 2>&1

# Verificación de backup (diario a las 06:00)
0 6 * * * /path/to/chefchek/backend/scripts/verify-backup.sh >> /var/log/chefchek-verify.log 2>&1

# Rotación de logs (semanal, domingos 05:00)
0 5 * * 0 /usr/sbin/logrotate /etc/logrotate.d/chefchek-backup

# Monitoreo de espacio (cada 6 horas)
0 */6 * * * /path/to/chefchek/backend/scripts/check-disk-space.sh
```

### Configuración de Log Rotation

Crear archivo `/etc/logrotate.d/chefchek-backup`:

```bash
/var/log/chefchek-backup.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        # Reload application if needed
        docker kill --signal=USR1 chefchek-backend-1
    endscript
}

/var/log/chefchek-restore.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
```

### Configuración Systemd Timer (Alternativa)

Crear servicio systemd para mejor control:

**`/etc/systemd/system/chefchek-backup.service`**:
```ini
[Unit]
Description=ChefChek Backup Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/path/to/chefchek/backend
ExecStart=/path/to/chefchek/backend/scripts/backup.sh
StandardOutput=journal
StandardError=journal
```

**`/etc/systemd/system/chefchek-backup.timer`**:
```ini
[Unit]
Description=ChefChek Backup Timer
Requires=chefchek-backup.service

[Timer]
OnCalendar=*-*-* 02:00:00
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Habilitar timer:
```bash
systemctl enable chefchek-backup.timer
systemctl start chefchek-backup.timer
```

---

## Verificación y Testing de Restore

### Verificación de Integridad de Backup

#### 1. Checksum Verification

```bash
# Verificar checksum MD5
md5sum -c chefchek_daily_20250603_020000.dump.gz.md5

# Verificar checksum SHA256
sha256sum -c chefchek_daily_20250603_020000.dump.gz.sha256

# Output esperado:
# chefchek_daily_20250603_020000.dump.gz: OK
```

#### 2. pg_restore --list (Ver contenido backup)

```bash
# Listar contenido de backup custom format
pg_restore --list chefchek_daily_20250603_020000.dump.gz

# Filtrar por schema
pg_restore --list chefchek_daily_20250603_020000.dump.gz | grep "public."

# Contar objetos en backup
pg_restore --list chefchek_daily_20250603_020000.dump.gz | wc -l
```

#### 3. Tamaño de Backup

```bash
# Verificar tamaño backup
ls -lh chefchek_daily_20250603_020000.dump.gz

# Comparar con backups anteriores
ls -lht /var/backups/chefchek/daily/ | head -5

# Alerta si tamaño es < 80% de promedio
#!/bin/bash
BACKUP_SIZE=$(stat -f%z chefchek_daily_20250603_020000.dump.gz)
AVG_SIZE=$(ls -l /var/backups/chefchek/daily/*.dump.gz | awk '{sum+=$5} END {print sum/NR}')
if [ $BACKUP_SIZE -lt $(($AVG_SIZE * 8 / 10)) ]; then
    echo "WARNING: Backup size is suspiciously small!"
    exit 1
fi
```

### Testing Mensual de Restauración

#### Procedimiento Automatizado

Crear script `/backend/scripts/test-restore.sh`:

```bash
#!/bin/bash
# Test mensual de restauración de backups

set -euo pipefail

BACKUP_FILE="/var/backups/chefchek/daily/chefchek_daily_$(date +%Y%m%d)_020000.dump.gz"
TEST_DB="chefchek_test_restore"
LOG_FILE="/var/log/chefchek-test-restore.log"

echo "[$(date)] Starting restore test..." >> "$LOG_FILE"

# 1. Crear DB de testing
echo "[$(date)] Creating test database..." >> "$LOG_FILE"
psql -c "DROP DATABASE IF EXISTS $TEST_DB;"
pssql -c "CREATE DATABASE $TEST_DB;"

# 2. Restaurar backup
echo "[$(date)] Restoring backup..." >> "$LOG_FILE"
pg_restore -d $TEST_DB "$BACKUP_FILE" >> "$LOG_FILE" 2>&1

# 3. Verificar datos críticos
echo "[$(date)] Verifying critical data..." >> "$LOG_FILE"
USER_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM users;")
ORDER_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM orders;")
PRODUCT_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM products;")

echo "Users: $USER_COUNT, Orders: $ORDER_COUNT, Products: $PRODUCT_COUNT" >> "$LOG_FILE"

if [ $USER_COUNT -lt 100 ] || [ $PRODUCT_COUNT -lt 10 ]; then
    echo "[$(date)] ERROR: Data count is suspicious!" >> "$LOG_FILE"
    exit 1
fi

# 4. Limpiar
echo "[$(date)] Cleaning up..." >> "$LOG_FILE"
psql -c "DROP DATABASE $TEST_DB;"

echo "[$(date)] Restore test completed successfully!" >> "$LOG_FILE"
```

### Monitoreo de Backup Size

```bash
# Script para monitorear tamaño backups
#!/bin/bash

THRESHOLD_GB=10
BACKUP_DIR="/var/backups/chefchek/daily"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.dump.gz | head -1)
SIZE_GB=$(du -h "$LATEST_BACKUP" | cut -f1 | sed 's/G//')

if (( $(echo "$SIZE_GB < $THRESHOLD_GB" | bc -l) )); then
    echo "ALERT: Latest backup is only ${SIZE_GB}GB (threshold: ${THRESHOLD_GB}GB)"
    # Send notification
    curl -X POST "$SLACK_WEBHOOK" \
         -H 'Content-Type: application/json' \
         -d "{\"text\": \"⚠️ Backup size alert: ${SIZE_GB}GB\"}"
fi
```

### Alertas de Backup Fallido

```bash
# Configurar monitoreo
# 1. Verificar exit code de backup script
if ! ./scripts/backup.sh; then
    # Enviar email
    mail -s "⚠️ ChefChek Backup Failed" admin@chefchek.com <<< "Backup failed at $(date)"
    
    # Enviar Slack alerta
    curl -X POST "$SLACK_WEBHOOK" \
         -H 'Content-Type: application/json' \
         -d '{"text": "🚨 ChefChek backup failed!"}'
fi

# 2. Verificar archivo backup creado
if [ ! -f "/var/backups/chefchek/daily/chefchek_daily_$(date +%Y%m%d)_020000.dump.gz" ]; then
    echo "ERROR: Backup file not created!"
    # Trigger alert
fi
```

---

## Consideraciones Dokploy-Específicas

### Backup de Configuración Dokploy

```bash
# Exportar configuración Dokploy
dokploy config export > dokploy-config-$(date +%Y%m%d).json

# Backup de environment variables
dokploy env export > dokploy-env-$(date +%Y%m%d).env

# Backup de aplicaciones
dokploy apps backup > dokploy-apps-$(date +%Y%m%d).tar.gz
```

### Backup de Volúmenes Docker

```bash
# Identificar volúmenes ChefChek
docker volume ls | grep chefchek

# Backup volumen específico
docker run --rm -v chefchek_postgres_data:/data -v /tmp/backups:/backup \
  alpine tar czf /backup/chefchek-volume-$(date +%Y%m%d).tar.gz /data

# Listar volúmenes a backup
VOLUMES=(
  "chefchek_postgres_data"
  "chefchek_uploads"
  "chefchek_logs"
)

for vol in "${VOLUMES[@]}"; do
  docker run --rm -v ${vol}:/data -v /tmp/backups:/backup \
    alpine tar czf /backup/${vol}-$(date +%Y%m%d).tar.gz /data
done
```

### Restauración en Dokploy UI

1. **Preparar backup**
   - Subir archivo `.dump.gz` a servidor Dokploy
   - Colocar en `/var/backups/chefchek/`

2. **Dokploy UI → Settings → Backup**
   - Click "Restore from Backup"
   - Seleccionar archivo
   - Confirmar restauración

3. **Verificar en Dokploy**
   - Dashboard → Status
   - Logs → verify no errors
   - Health Check → Green

### Environment Variables Backup

```bash
# Exportar variables entorno (Dokploy)
dokploy project env export > chefchek-env-$(date +%Y%m%d).env

# Exportar variables Docker Compose
docker-compose config | grep -A 100 "environment:" > env-backup-$(date +%Y%m%d).txt

# Backup .env manual (si existe)
cp /path/to/.env /var/backups/chefchek/env-$(date +%Y%m%d).env
chmod 600 /var/backups/chefchek/env-$(date +%Y%m%d).env
```

---

## Plan de Testing y Mantenimiento

### Testing Semanal

- [ ] Verificar que backup diario se creó exitosamente
- [ ] Chequear tamaño backup (> mínimo esperado)
- [ ] Validar checksums MD5/SHA256
- [ ] Revisar logs de backup sin errores

### Testing Mensual

- [ ] Ejecutar test restore en ambiente staging
- [ ] Verificar datos críticos restaurados
- [ ] Validar funcionalidad core app
- [ ] Medir tiempo restauración (RTO)
- [ ] Documentar findings

### Testing Trimestral

- [ ] Full disaster recovery drill
- [ ] Simular ransomware scenario
- [ ] Test failover a región standby
- [ ] Revisar y actualizar runbooks
- [ ] Training equipo response

### Testing Anual

- [ ] Audit completo de backup strategy
- [ ] Revisión RPO/RTO objetivos
- [ ] Evaluación vendor storage (S3/B2)
- [ ] Update documentación y runbooks
- [ ] Certificaciones de compliance

---

## Contactos y Responsibilities

### Rol Disaster Recovery

| Rol | Responsabilidades | Contacto |
|-----|-------------------|-----------|
| **Team Lead** | Decisión de activación DR, comunicación stakeholders | - |
| **DevOps Engineer** | Ejecución scripts, infraestructura, monitoreo | - |
| **Database Admin** | PostgreSQL troubleshooting, optimización queries | - |
| **Backend Developer** | Application fixes, verificación datos | - |
| **Security Officer** | Investigación incidentes, hardening post-restore | - |
| **Support Lead** | Comunicación customers, status updates | - |

### Escalation Matrix

```
Tier 1: DevOps + DB Admin (resolver en 30min)
  ↓ No resuelto
Tier 2: Team Lead + Backend Dev (resolver en 1h)
  ↓ No resuelto
Tier 3: Management + Security + Legal (activación DR plan)
```

---

## Métricas y Monitoreo

### KPIs de Backup

| Métrica | Objetivo | Monitoreo |
|---------|----------|-----------|
| **Backup成功率** | > 99.5% | Diaria |
| **Backup Size** | 5-15 GB | Diaria |
| **Restore Time** | < 2h (RTO) | Mensual (test) |
| **Data Loss** | < 24h (RPO) | Continuo (WAL) |
| **Storage Cost** | < $50/mes | Mensual |

### Alertas

```bash
# Backup failure → PagerDuty → On-call DevOps
# Backup size anomaly → Slack #devops
# Restore test failure → Email to Team Lead
# Disk space < 20% → PagerDuty + Slack
```

---

## Checklist Operacional

### Diario (Automated)
- [x] Backup diario ejecutado
- [x] Checksum validado
- [x] Upload S3 completado
- [x] Logs sin errores

### Semanal (Manual)
- [ ] Verificar 7 últimos backups exitosos
- [ ] Chequear espacio disco (> 20% libre)
- [ ] Revisar logs de warnings
- [ ] Testing restore quick

### Mensual (Manual)
- [ ] Full restore test staging
- [ ] Revisar retención backups
- [ ] Update runbooks si necesario
- [ ] Meeting review DR status

---

## Recursos Adicionales

### Documentación PostgreSQL
- [pg_dump documentation](https://www.postgresql.org/docs/14/app-pgdump.html)
- [pg_restore documentation](https://www.postgresql.org/docs/14/app-pgrestore.html)
- [PITR documentation](https://www.postgresql.org/docs/14/continuous-archiving.html)

### Scripts Related
- `/backend/scripts/backup.sh` - Script backup principal
- `/backend/scripts/restore.sh` - Script restauración
- `/backend/scripts/verify-backup.sh` - Verificación integridad
- `/backend/scripts/test-restore.sh` - Testing mensual

### Comandos Útiles

```bash
# Ver tamaño base de datos
psql -c "SELECT pg_size_pretty(pg_database_size('chefchek'));"

# Ver tamaño tabla
psql -c "SELECT relname, pg_size_pretty(pg_relation_size(relname)) FROM pg_class ORDER BY pg_relation_size(relname) DESC LIMIT 10;"

# Ver conexiones activas
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Matar conexiones a DB
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'chefchek';"

# Vacuum analyze
psql -c "VACUUM ANALYZE;"
```

---

**Documento mantenido por**: DevOps Team  
**Última actualización**: 2025-06-03  
**Versión**: 1.0  
**Frecuencia de revisión**: Trimestral