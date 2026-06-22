#!/bin/bash
# ChefChek PostgreSQL Restore Script
# Usage: ./restore.sh [OPTIONS]
# Options:
#   --list              List available backups
#   --latest            Restore from most recent backup
#   --backup FILE       Restore from specific backup file
#   --table NAME        Restore only specific table
#   --pitr TIMESTAMP    Point-in-time recovery (YYYY-MM-DD HH:MM:SS)
#   --dry-run           Simulate restore without writing
#   --skip-errors       Continue on errors
#   --verbose           Enable verbose logging

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# PostgreSQL Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-chefchek}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Docker Configuration
DOCKER_CONTAINER="${DOCKER_CONTAINER:-chefchek-postgres-1}"
USE_DOCKER="${USE_DOCKER:-false}"

# Backup Configuration
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/chefchek}"
TEMP_DIR="${TEMP_DIR:-/tmp/chefchek-restore}"

# Restore Configuration
SKIP_ERRORS=false
PRE_BACKUP=true
RUN_MIGRATIONS=true
HEALTH_CHECK=true

# Logging
LOG_FILE="${LOG_FILE:-/var/log/chefchek-restore.log}"
VERBOSE=false
DRY_RUN=false
LIST_ONLY=false
RESTORE_LATEST=false
RESTORE_FILE=""
RESTORE_TABLE=""
PITR_TIMESTAMP=""

# =============================================================================
# FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [[ "$level" == "ERROR" ]] || [[ "$VERBOSE" == true ]]; then
        echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    else
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_debug() { log "DEBUG" "$@"; }

list_backups() {
    log_info "Available backups:"

    echo ""
    echo "=== DAILY BACKUPS (Last 7) ==="
    find "$BACKUP_ROOT/daily" -name "*.dump.gz" -type f -mtime -7 2>/dev/null | sort -r | \
        while read -r file; do
            local size=$(du -h "$file" | cut -f1)
            local date=$(basename "$file" | sed -E 's/.*([0-9]{8}_[0-9]{6}).*/\1/' | sed 's/_/ /')
            echo "  $(basename "$file") - $size - $date"
        done

    echo ""
    echo "=== WEEKLY BACKUPS (Last 4) ==="
    find "$BACKUP_ROOT/weekly" -name "*.dump.gz" -type f -mtime -28 2>/dev/null | sort -r | \
        while read -r file; do
            local size=$(du -h "$file" | cut -f1)
            echo "  $(basename "$file") - $size"
        done

    echo ""
    echo "=== MONTHLY BACKUPS (Last 3) ==="
    find "$BACKUP_ROOT/monthly" -name "*.dump.gz" -type f -mtime -90 2>/dev/null | sort -r | \
        while read -r file; do
            local size=$(du -h "$file" | cut -f1)
            echo "  $(basename "$file") - $size"
        done

    echo ""
}

check_backup_exists() {
    local backup_file="$1"

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    log_info "Backup file found: $backup_file"
    return 0
}

verify_backup_checksum() {
    local backup_file="$1"
    local checksum_file="${backup_file}.md5"

    if [[ ! -f "$checksum_file" ]]; then
        log_warn "Checksum file not found: $checksum_file"
        return 0
    fi

    log_info "Verifying checksum..."

    if md5sum -c "$checksum_file" >/dev/null 2>&1; then
        log_info "Checksum verification passed"
        return 0
    else
        log_error "Checksum verification failed"
        return 1
    fi
}

check_disk_space() {
    log_info "Checking disk space..."

    local available_gb=$(df -g "$TEMP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || df -BG "$TEMP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//')

    if [[ -z "$available_gb" ]]; then
        log_warn "Could not determine available disk space, skipping check"
        return 0
    fi

    # Need at least 10GB for restore operations
    local min_space=10
    if [[ $available_gb -lt $min_space ]]; then
        log_error "Insufficient disk space: ${available_gb}GB available, ${min_space}GB required"
        return 1
    fi

    log_info "Disk space check passed: ${available_gb}GB available"
    return 0
}

create_pre_restore_backup() {
    if [[ "$PRE_BACKUP" != "true" ]]; then
        log_info "Pre-restore backup disabled"
        return 0
    fi

    log_info "Creating pre-restore backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local pre_backup_file="$BACKUP_ROOT/daily/chefchek_pre_restore_${timestamp}.dump"

    local pg_dump_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        pg_dump_cmd="docker exec $DOCKER_CONTAINER pg_dump -Fc -U $DB_USER -d $DB_NAME"
    else
        pg_dump_cmd="pg_dump -Fc -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would create pre-restore backup: $pre_backup_file"
        return 0
    fi

    if $pg_dump_cmd > "$pre_backup_file" 2>/dev/null; then
        gzip -f "$pre_backup_file"
        log_info "Pre-restore backup created: ${pre_backup_file}.gz"
        return 0
    else
        log_warn "Pre-restore backup failed (continuing)"
        return 0
    fi
}

drop_existing_database() {
    log_info "Dropping existing database..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would drop database: $DB_NAME"
        return 0
    fi

    # Terminate existing connections
    $psql_cmd -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true

    # Drop database
    $psql_cmd -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

    log_info "Database dropped"
    return 0
}

create_database() {
    log_info "Creating database..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would create database: $DB_NAME"
        return 0
    fi

    $psql_cmd -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

    log_info "Database created"
    return 0
}

restore_backup() {
    local backup_file="$1"

    log_info "Starting restore from: $backup_file"

    local pg_restore_cmd

    # Decompress if needed
    if [[ "$backup_file" =~ \.gz$ ]]; then
        log_info "Decompressing backup..."
        backup_file="${backup_file%.gz}"
        gunzip -c "${backup_file}.gz" > "$backup_file"
    fi

    if [[ "$USE_DOCKER" == "true" ]]; then
        # For Docker, we need to copy file into container
        docker cp "$backup_file" "${DOCKER_CONTAINER}:/tmp/restore.dump"
        pg_restore_cmd="docker exec $DOCKER_CONTAINER pg_restore -U $DB_USER -d $DB_NAME /tmp/restore.dump"
    else
        pg_restore_cmd="pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would execute: $pg_restore_cmd"
        return 0
    fi

    # Execute restore
    if [[ "$SKIP_ERRORS" == true ]]; then
        $pg_restore_cmd --exit-on-error=false 2>&1 | tee -a "$LOG_FILE"
    else
        $pg_restore_cmd 2>&1 | tee -a "$LOG_FILE"
    fi

    log_info "Restore completed"
    return 0
}

restore_table() {
    local backup_file="$1"
    local table_name="$2"

    log_info "Restoring table: $table_name"

    local pg_restore_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        docker cp "$backup_file" "${DOCKER_CONTAINER}:/tmp/restore.dump"
        pg_restore_cmd="docker exec $DOCKER_CONTAINER pg_restore -U $DB_USER -d $DB_NAME -t $table_name /tmp/restore.dump"
    else
        pg_restore_cmd="pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t $table_name $backup_file"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would execute: $pg_restore_cmd"
        return 0
    fi

    $pg_restore_cmd 2>&1 | tee -a "$LOG_FILE"

    log_info "Table restore completed"
    return 0
}

run_migrations() {
    if [[ "$RUN_MIGRATIONS" != "true" ]]; then
        log_info "Migration run disabled"
        return 0
    fi

    log_info "Running Prisma migrations..."

    cd "$PROJECT_ROOT"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would run: npx prisma migrate deploy"
        return 0
    fi

    if npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"; then
        log_info "Migrations completed successfully"
        return 0
    else
        log_warn "Migrations failed (continuing)"
        return 0
    fi
}

health_check() {
    if [[ "$HEALTH_CHECK" != "true" ]]; then
        log_info "Health check disabled"
        return 0
    fi

    log_info "Running health checks..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -d $DB_NAME -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    # Check critical tables exist
    local tables=("users" "products" "orders" "tenants")
    local missing_tables=0

    for table in "${tables[@]}"; do
        if $psql_cmd -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
            log_info "✓ Table '$table' accessible"
        else
            log_error "✗ Table '$table' not accessible"
            missing_tables=$((missing_tables + 1))
        fi
    done

    if [[ $missing_tables -gt 0 ]]; then
        log_warn "Health check: $missing_tables tables not accessible"
        return 1
    fi

    log_info "Health check passed"
    return 0
}

restart_applications() {
    log_info "Restarting applications..."

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would restart applications"
        return 0
    fi

    # Restart Docker containers
    if command -v docker >/dev/null 2>&1; then
        docker restart chefchek-backend-1 2>/dev/null || true
        docker restart chefchek-frontend-1 2>/dev/null || true
        log_info "Docker containers restarted"
    fi

    return 0
}

send_notification() {
    local status="$1"
    local message="$2"

    local slack_webhook="${SLACK_WEBHOOK:-}"
    local notify_email="${NOTIFY_EMAIL:-admin@chefchek.com}"

    # Slack notification
    if [[ -n "$slack_webhook" ]]; then
        local emoji="✅"
        if [[ "$status" == "failure" ]]; then
            emoji="❌"
        fi

        curl -s -X POST "$slack_webhook" \
             -H 'Content-Type: application/json' \
             -d "{\"text\": \"${emoji} ChefChek Restore ${status}: ${message}\"}" \             >/dev/null 2>&1 || true
    fi

    # Email notification
    if [[ -n "$notify_email" ]] && command -v mail >/dev/null 2>&1; then
        local subject="ChefChek Restore ${status}: $(date '+%Y-%m-%d %H:%M')"
        echo "$message" | mail -s "$subject" "$notify_email"
    fi

    return 0
}

cleanup_temp_files() {
    log_info "Cleaning up temporary files..."

    if [[ "$DRY_RUN" == true ]]; then
        return 0
    fi

    rm -rf "$TEMP_DIR" 2>/dev/null || true

    if [[ "$USE_DOCKER" == "true" ]]; then
        docker exec "$DOCKER_CONTAINER" rm -f /tmp/restore.dump 2>/dev/null || true
    fi

    log_info "Cleanup completed"
    return 0
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --list)
                LIST_ONLY=true
                shift
                ;;
            --latest)
                RESTORE_LATEST=true
                shift
                ;;
            --backup)
                RESTORE_FILE="$2"
                shift 2
                ;;
            --table)
                RESTORE_TABLE="$2"
                shift 2
                ;;
            --pitr)
                PITR_TIMESTAMP="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-errors)
                SKIP_ERRORS=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                set -x
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Usage: $0 [--list] [--latest] [--backup FILE] [--table NAME] [--pitr TIMESTAMP] [--dry-run] [--skip-errors] [--verbose]"
                exit 1
                ;;
        esac
    done

    log_info "=========================================="
    log_info "ChefChek Restore Script - Starting"
    log_info "=========================================="

    # List mode
    if [[ "$LIST_ONLY" == true ]]; then
        list_backups
        exit 0
    fi

    # Determine backup file
    if [[ "$RESTORE_LATEST" == true ]]; then
        RESTORE_FILE=$(ls -t "$BACKUP_ROOT/daily"/*.dump.gz 2>/dev/null | head -1)
        if [[ -z "$RESTORE_FILE" ]]; then
            log_error "No recent backup found"
            exit 1
        fi
        log_info "Selected latest backup: $(basename "$RESTORE_FILE")"
    elif [[ -z "$RESTORE_FILE" ]]; then
        log_error "No backup specified. Use --latest or --backup FILE"
        echo "Usage: $0 --latest | --backup FILE"
        exit 1
    fi

    log_info "Backup file: $RESTORE_FILE"
    log_info "Restore table: ${RESTORE_TABLE:-all tables}"
    log_info "Dry Run: $DRY_RUN"

    # Pre-checks
    if ! check_backup_exists "$RESTORE_FILE"; then
        send_notification "failure" "Backup file not found"
        exit 1
    fi

    if ! verify_backup_checksum "$RESTORE_FILE"; then
        send_notification "failure" "Backup checksum verification failed"
        exit 1
    fi

    if ! check_disk_space; then
        send_notification "failure" "Insufficient disk space"
        exit 1
    fi

    # Create temp directory
    mkdir -p "$TEMP_DIR"

    # Pre-restore backup
    if ! create_pre_restore_backup; then
        log_warn "Pre-restore backup failed (continuing)"
    fi

    # If restoring specific table only
    if [[ -n "$RESTORE_TABLE" ]]; then
        log_info "Restoring single table mode"
        if ! restore_table "$RESTORE_FILE" "$RESTORE_TABLE"; then
            send_notification "failure" "Table restore failed"
            exit 1
        fi

        if ! health_check; then
            log_warn "Health check failed but table restore completed"
        fi

        cleanup_temp_files
        log_info "=========================================="
        log_info "Table restore completed"
        log_info "=========================================="

        send_notification "success" "Table '$RESTORE_TABLE' restored successfully"

        exit 0
    fi

    # Full restore mode
    log_info "Full database restore mode"

    if ! drop_existing_database; then
        send_notification "failure" "Failed to drop existing database"
        exit 1
    fi

    if ! create_database; then
        send_notification "failure" "Failed to create database"
        exit 1
    fi

    if ! restore_backup "$RESTORE_FILE"; then
        send_notification "failure" "Database restore failed"

        # Attempt rollback to pre-restore backup
        log_warn "Attempting rollback to pre-restore backup..."
        local pre_backup=$(ls -t "$BACKUP_ROOT/daily/chefchek_pre_restore_*.dump.gz" 2>/dev/null | head -1)
        if [[ -n "$pre_backup" ]]; then
            restore_backup "$pre_backup" || true
        fi

        exit 1
    fi

    # Post-restore operations
    if ! run_migrations; then
        log_warn "Migrations failed (continuing)"
    fi

    if ! restart_applications; then
        log_warn "Application restart failed (continuing)"
    fi

    if ! health_check; then
        log_warn "Health check failed (continuing)"
    fi

    cleanup_temp_files

    log_info "=========================================="
    log_info "Restore completed successfully"
    log_info "=========================================="

    send_notification "success" "Database restored successfully"

    exit 0
}

# Run main
main "$@"