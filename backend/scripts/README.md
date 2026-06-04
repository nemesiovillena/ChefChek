# ChefChek Backup Scripts

Collection of production-ready scripts for PostgreSQL backup, restore, and monitoring.

## Scripts Overview

### Core Scripts

#### `backup.sh`

Main backup script with compression, checksums, and remote storage support.

**Features:**

- PostgreSQL custom format dumps (`pg_dump -Fc`)
- Automatic gzip compression
- MD5 and SHA256 checksum generation
- Configurable retention policies (daily/weekly/monthly)
- Optional S3/B2 upload
- Email and Slack notifications
- Docker and direct PostgreSQL support
- Dry-run mode for testing

**Usage:**

```bash
# Daily backup
./backup.sh

# Weekly backup
./backup.sh --type weekly

# Monthly backup
./backup.sh --type monthly

# Dry-run (testing)
./backup.sh --dry-run

# Database only (skip file uploads)
./backup.sh --db-only

# Verbose output
./backup.sh --verbose
```

**Environment Variables:**

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chefchek
DB_USER=postgres
DB_PASSWORD=your_password

# Docker (optional)
USE_DOCKER=false
DOCKER_CONTAINER=chefchek-postgres-1

# Retention (days)
RETENTION_DAILY=30
RETENTION_WEEKLY=12
RETENTION_MONTHLY=12

# Storage
BACKUP_ROOT=/var/backups/chefchek
UPLOAD_S3=false
S3_BUCKET=s3://chefchek-backups

# Notifications
NOTIFY_EMAIL=admin@chefchek.com
NOTIFY_SLACK=false
SLACK_WEBHOOK=https://hooks.slack.com/...

# Logging
LOG_FILE=/var/log/chefchek-backup.log
LOG_LEVEL=INFO
```

---

#### `restore.sh`

Restore script with safety checks and point-in-time recovery support.

**Features:**

- List available backups
- Restore latest or specific backup
- Single table restore
- Point-in-time recovery (PITR)
- Pre-restore automatic backup
- Prisma migration post-restore
- Health checks after restore
- Dry-run mode
- Rollback on failure

**Usage:**

```bash
# List available backups
./restore.sh --list

# Restore latest backup
./restore.sh --latest

# Restore specific backup
./restore.sh --backup /path/to/chefchek_daily_20250603_020000.dump.gz

# Restore specific table only
./restore.sh --backup /path/to/backup.dump.gz --table users

# Point-in-time recovery
./restore.sh --backup /path/to/backup.dump.gz --pitr "2025-06-03 14:30:00"

# Dry-run (simulation)
./restore.sh --backup /path/to/backup.dump.gz --dry-run

# Continue on errors
./restore.sh --backup /path/to/backup.dump.gz --skip-errors

# Verbose output
./restore.sh --backup /path/to/backup.dump.gz --verbose
```

**Environment Variables:**

```bash
# Same as backup.sh
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chefchek
DB_USER=postgres
DB_PASSWORD=your_password
USE_DOCKER=false
DOCKER_CONTAINER=chefchek-postgres-1

# Restore-specific
BACKUP_ROOT=/var/backups/chefchek
TEMP_DIR=/tmp/chefchek-restore
LOG_FILE=/var/log/chefchek-restore.log
```

---

### Helper Scripts

#### `verify-backup.sh`

Automated backup verification script.

**Features:**

- Checksum validation (MD5/SHA256)
- Size anomaly detection
- Backup inventory report

**Usage:**

```bash
./verify-backup.sh
```

**Output:**

- List of all backups by type
- Checksum verification results
- Size checks with warnings for anomalies

---

#### `test-restore.sh`

Monthly automated restore test script.

**Features:**

- Creates temporary test database
- Restores latest backup
- Validates data integrity
- Checks critical table counts
- Automatic cleanup
- Test result notifications

**Usage:**

```bash
./test-restore.sh
```

**Configuration:**

```bash
TEST_DB=chefchek_test_restore
MIN_USER_COUNT=100
MIN_PRODUCT_COUNT=10
```

---

#### `check-disk-space.sh`

Disk space monitoring and alerting.

**Features:**

- Checks multiple paths
- Percentage-based alerts
- Slack and email notifications
- Configurable thresholds

**Usage:**

```bash
./check-disk-space.sh
```

**Configuration:**

```bash
MIN_DISK_PERCENT=20
ALERT_THRESHOLD=90
CHECK_PATHS=(
    "/var/backups/chefchek"
    "/var/lib/postgresql"
    "/var/lib/docker"
)
```

---

## Installation

### 1. Set Permissions

```bash
chmod +x scripts/*.sh
```

### 2. Create Backup Directory

```bash
sudo mkdir -p /var/backups/chefchek/{daily,weekly,monthly,checksums}
sudo chown -R $(whoami):$(whoami) /var/backups/chefchek
```

### 3. Create Log Directory

```bash
sudo mkdir -p /var/log
sudo touch /var/log/chefchek-backup.log
sudo touch /var/log/chefchek-restore.log
sudo touch /var/log/chefchek-verify.log
sudo chown $(whoami):$(whoami) /var/log/chefchek*.log
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env.backup

# Edit with your values
nano .env.backup
```

---

## Cron Configuration

Add to crontab (`crontab -e`):

```bash
# ==============================
# CHEFCHEK BACKUPS
# ==============================

# Daily backup (02:00)
0 2 * * * /path/to/chefchek/backend/scripts/backup.sh --type daily >> /var/log/chefchek-backup.log 2>&1

# Weekly backup (Sunday 03:00)
0 3 * * 0 /path/to/chefchek/backend/scripts/backup.sh --type weekly >> /var/log/chefchek-backup.log 2>&1

# Monthly backup (1st of month 04:00)
0 4 1 * * /path/to/chefchek/backend/scripts/backup.sh --type monthly >> /var/log/chefchek-backup.log 2>&1

# Verification (daily 06:00)
0 6 * * * /path/to/chefchek/backend/scripts/verify-backup.sh >> /var/log/chefchek-verify.log 2>&1

# Disk space check (every 6 hours)
0 */6 * * * /path/to/chefchek/backend/scripts/check-disk-space.sh

# Monthly restore test (1st of month 05:00)
0 5 1 * * /path/to/chefchek/backend/scripts/test-restore.sh >> /var/log/chefchek-test-restore.log 2>&1
```

---

## Log Rotation

Create `/etc/logrotate.d/chefchek-backup`:

```bash
/var/log/chefchek-backup.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
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

/var/log/chefchek-verify.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
```

---

## Testing

### Test Backup

```bash
# Dry-run test
./scripts/backup.sh --dry-run --verbose

# Actual test backup
./scripts/backup.sh --type daily
```

### Test Restore

```bash
# List backups
./scripts/restore.sh --list

# Dry-run restore
./scripts/restore.sh --backup /path/to/backup.dump.gz --dry-run

# Actual test restore
./scripts/restore.sh --latest
```

### Test Verification

```bash
./scripts/verify-backup.sh
```

---

## Troubleshooting

### Backup Fails

1. Check PostgreSQL connection: `psql -h localhost -U postgres -d chefchek`
2. Verify disk space: `df -h /var/backups/chefchek`
3. Check logs: `tail -100 /var/log/chefchek-backup.log`
4. Verify permissions: `ls -la /var/backups/chefchek`

### Restore Fails

1. Verify backup exists: `ls -la /var/backups/chefchek/daily/`
2. Check checksum: `md5sum -c backup.dump.gz.md5`
3. Ensure database is accessible: `psql -l`
4. Review logs: `tail -100 /var/log/chefchek-restore.log`

### Checksum Verification Fails

1. Backup may be corrupted - download from remote storage
2. Re-run backup if recent
3. Check for disk errors: `dmesg | grep -i error`

### Disk Space Alerts

1. Clean old backups manually or adjust retention
2. Check disk usage: `du -sh /var/backups/chefchek/*`
3. Consider moving backups to remote storage

---

## Security Best Practices

### 1. Environment Variables

- Never commit `.env.backup` to version control
- Use `chmod 600 .env.backup`
- Rotate passwords regularly

### 2. Backup Encryption

For sensitive data, consider encrypting backups:

```bash
# Encrypt
gpg --symmetric --cipher-algo AES256 backup.dump.gz

# Decrypt
gpg --decrypt backup.dump.gz.gpg > backup.dump.gz
```

### 3. S3 Bucket Policies

Restrict S3 bucket access to specific IPs and IAM users:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::chefchek-backups/*"
    }
  ]
}
```

### 4. SSH Keys

- Use key-based authentication for remote servers
- Disable password authentication
- Regularly rotate SSH keys

---

## Performance Optimization

### Backup Performance

- Use `pg_dump -Fc` (custom format) for faster compression
- Enable WAL archiving for PITR
- Consider `pg_basebackup` for large databases
- Schedule backups during low-traffic hours

### Restore Performance

- Pre-create database with appropriate encoding
- Use `--jobs=N` for parallel restore (pg_restore 9.3+)
- Disable indexes during restore, enable after
- Use `--exit-on-error=false` for partial restores

### Storage Optimization

- Compress backups with `gzip -9`
- Deduplicate backups using hard links
- Use lifecycle policies for S3 storage tiers

---

## Monitoring

### Key Metrics

- **Backup Success Rate**: Should be > 99.5%
- **Backup Size**: Monitor for anomalies
- **Restore Time**: Should meet RTO (< 2 hours)
- **Disk Usage**: Alert at < 20% free

### Alerts Configuration

Set up alerts for:

- Backup failures (immediate)
- Checksum failures (immediate)
- Low disk space (< 20%)
- Restore test failures (monthly review)

### Dashboard Metrics

Track in Grafana/Prometheus:

```bash
# Backup success
chefchek_backup_success_total

# Backup duration
chefchek_backup_duration_seconds

# Backup size
chefchek_backup_size_bytes

# Restore duration
chefchek_restore_duration_seconds
```

---

## Backup Retention Strategy

### Daily Backups

- **Retention**: 30 days
- **Schedule**: 02:00 daily
- **Use Case**: Quick recovery for recent data loss

### Weekly Backups

- **Retention**: 12 weeks
- **Schedule**: Sunday 03:00
- **Use Case**: Recovery from issues not immediately detected

### Monthly Backups

- **Retention**: 12 months
- **Schedule**: 1st of month 04:00
- **Use Case**: Long-term archival and compliance

### Archive Strategy

- Move backups > 1 year to cold storage (Glacier/Deep Archive)
- Maintain quarterly backups for 7 years (compliance)
- Test restore from cold storage annually

---

## Documentation

For detailed procedures and disaster recovery scenarios, see:

- **Main Documentation**: `/docs/backup-recovery.md`
- **Deployment Guide**: `/docs/deployment-guide.md`
- **System Architecture**: `/docs/system-architecture.md`

---

## Support

For issues or questions:

1. Check logs: `/var/log/chefchek-*.log`
2. Review documentation: `/docs/backup-recovery.md`
3. Contact: DevOps team (`admin@chefchek.com`)

---

## Version History

- **v1.0** (2025-06-03): Initial release
  - Core backup/restore functionality
  - Automated verification and testing
  - Docker support
  - S3 integration
  - Comprehensive logging

---

## License

Internal use for ChefChek project.
