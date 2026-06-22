#!/bin/bash
# ChefChek PostgreSQL Backup Script
# Usage: ./backup.sh [OPTIONS]
# Options:
#   --dry-run       Simulate backup without writing files
#   --db-only       Backup database only (skip file uploads)
#   --verbose       Enable verbose logging
#   --type TYPE     Backup type: daily|weekly|monthly (default: daily)

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
BACKUP_TYPE="${BACKUP_TYPE:-daily}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/chefchek}"
RETENTION_DAILY="${RETENTION_DAILY:-30}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-12}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"

# Remote Storage
UPLOAD_S3="${UPLOAD_S3:-false}"
S3_BUCKET="${S3_BUCKET:-s3://chefchek-backups}"
AWS_PROFILE="${AWS_PROFILE:-default}"

# Notifications
NOTIFY_EMAIL="${NOTIFY_EMAIL:-admin@chefchek.com}"
NOTIFY_SLACK="${NOTIFY_SLACK:-false}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Logging
LOG_FILE="${LOG_FILE:-/var/log/chefchek-backup.log}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
VERBOSE=false
DRY_RUN=false
DB_ONLY=false

# Minimum disk space (GB)
MIN_DISK_GB=5

# =============================================================================
# FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [[ "$level" == "ERROR" ]] || [[ "$VERBOSE" == true ]] || [[ "$LOG_LEVEL" == "DEBUG" ]]; then
        echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    else
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_debug() { log "DEBUG" "$@"; }

check_disk_space() {
    log_info "Checking disk space..."

    local available_gb=$(df -g "$BACKUP_ROOT" 2>/dev/null | awk 'NR==2 {print $4}' || df -BG "$BACKUP_ROOT" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//')

    if [[ -z "$available_gb" ]]; then
        log_warn "Could not determine available disk space, skipping check"
        return 0
    fi

    if [[ $available_gb -lt $MIN_DISK_GB ]]; then
        log_error "Insufficient disk space: ${available_gb}GB available, ${MIN_DISK_GB}GB required"
        return 1
    fi

    log_info "Disk space check passed: ${available_gb}GB available"
    return 0
}

check_postgres_connection() {
    log_info "Checking PostgreSQL connection..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -d $DB_NAME -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if $psql_cmd -c "SELECT 1" >/dev/null 2>&1; then
        log_info "PostgreSQL connection successful"
        return 0
    else
        log_error "PostgreSQL connection failed"
        return 1
    fi
}

create_backup_dirs() {
    log_info "Creating backup directories..."

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would create directories: $BACKUP_ROOT/{daily,weekly,monthly,checksums}"
        return 0
    fi

    mkdir -p "$BACKUP_ROOT/daily"
    mkdir -p "$BACKUP_ROOT/weekly"
    mkdir -p "$BACKUP_ROOT/monthly"
    mkdir -p "$BACKUP_ROOT/checksums"

    log_info "Backup directories created"
    return 0
}

backup_database() {
    log_info "Starting database backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_filename="chefchek_${BACKUP_TYPE}_${timestamp}.dump"
    local backup_path="$BACKUP_ROOT/$BACKUP_TYPE/$backup_filename"
    local pg_dump_cmd

    # Build pg_dump command
    if [[ "$USE_DOCKER" == "true" ]]; then
        pg_dump_cmd="docker exec $DOCKER_CONTAINER pg_dump -Fc -U $DB_USER -d $DB_NAME"
    else
        pg_dump_cmd="pg_dump -Fc -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    log_info "Backup file: $backup_path"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would execute: $pg_dump_cmd > $backup_path"
        return 0
    fi

    # Execute backup
    if $pg_dump_cmd > "$backup_path" 2>/dev/null; then
        log_info "Database backup completed successfully"
    else
        log_error "Database backup failed"
        return 1
    fi

    # Compress backup
    log_info "Compressing backup..."
    gzip -f "$backup_path"
    backup_path="${backup_path}.gz"

    # Generate checksums
    log_info "Generating checksums..."
    local checksum_dir="$BACKUP_ROOT/checksums"

    # MD5
    md5sum "$backup_path" > "${backup_path}.md5"
    cp "${backup_path}.md5" "$checksum_dir/"

    # SHA256
    sha256sum "$backup_path" > "${backup_path}.sha256"
    cp "${backup_path}.sha256" "$checksum_dir/"

    local backup_size=$(du -h "$backup_path" | cut -f1)
    log_info "Backup size: $backup_size"

    return 0
}

backup_files() {
    if [[ "$DB_ONLY" == true ]]; then
        log_info "Skipping file backup (--db-only flag set)"
        return 0
    fi

    log_info "Starting file backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local files_backup="chefchek-files_${BACKUP_TYPE}_${timestamp}.tar.gz"
    local files_path="$BACKUP_ROOT/$BACKUP_TYPE/$files_backup"

    # Files to backup (uploads and env only)
    local tar_args=()
    for item in "$PROJECT_ROOT/public/uploads" "$PROJECT_ROOT/.env"; do
        if [[ -e "$item" ]]; then
            tar_args+=("-C" "$(dirname "$item")" "$(basename "$item")")
        fi
    done

    if [[ ${#tar_args[@]} -eq 0 ]]; then
        log_info "No upload files or .env found, skipping file backup"
        return 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would backup files"
        return 0
    fi

    # Create file backup
    if tar czf "$files_path" "${tar_args[@]}" 2>/dev/null; then
        log_info "File backup completed successfully"

        # Generate checksum
        md5sum "$files_path" > "${files_path}.md5"
        cp "${files_path}.md5" "$BACKUP_ROOT/checksums/"
    else
        log_warn "File backup failed (continuing with database backup only)"
    fi

    return 0
}

rotate_backups() {
    log_info "Rotating old backups..."

    local retention_days
    local backup_type_dir="$BACKUP_ROOT/$BACKUP_TYPE"

    case "$BACKUP_TYPE" in
        daily)
            retention_days=$RETENTION_DAILY
            ;;
        weekly)
            retention_days=$((RETENTION_WEEKLY * 7))
            ;;
        monthly)
            retention_days=$((RETENTION_MONTHLY * 30))
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            return 1
            ;;
    esac

    log_info "Removing backups older than $retention_days days from $backup_type_dir"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would remove old backups from $backup_type_dir"
        find "$backup_type_dir" -name "*.dump.gz" -mtime +$retention_days -type f -print
        return 0
    fi

    # Remove old backups
    find "$backup_type_dir" -name "*.dump.gz" -mtime +$retention_days -type f -delete

    # Remove corresponding checksums
    find "$backup_type_dir" -name "*.md5" -mtime +$retention_days -type f -delete
    find "$backup_type_dir" -name "*.sha256" -mtime +$retention_days -type f -delete

    # Also clean old file backups
    find "$backup_type_dir" -name "chefchek-files_*.tar.gz" -mtime +$retention_days -type f -delete

    log_info "Backup rotation completed"
    return 0
}

upload_to_s3() {
    if [[ "$UPLOAD_S3" != "true" ]]; then
        log_info "S3 upload disabled (UPLOAD_S3=$UPLOAD_S3)"
        return 0
    fi

    log_info "Uploading to S3..."

    local s3_path="$S3_BUCKET/prod/$BACKUP_TYPE/"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY-RUN] Would upload to $s3_path"
        return 0
    fi

    if command -v aws >/dev/null 2>&1; then
        # Upload backup file
        local latest_backup=$(ls -t ${BACKUP_ROOT}/${BACKUP_TYPE}/chefchek_${BACKUP_TYPE}_*.dump.gz 2>/dev/null | head -1)

        if [[ -n "$latest_backup" ]]; then
            aws s3 cp "$latest_backup" "$s3_path" --profile "$AWS_PROFILE"
            aws s3 cp "${latest_backup}.md5" "$s3_path" --profile "$AWS_PROFILE"
            aws s3 cp "${latest_backup}.sha256" "$s3_path" --profile "$AWS_PROFILE"

            log_info "S3 upload completed"
        else
            log_warn "No backup file found to upload"
        fi
    else
        log_warn "AWS CLI not found, skipping S3 upload"
    fi

    return 0
}

send_notification() {
    local status="$1"  # "success" or "failure"
    local message="$2"

    log_info "Sending notification: $status"

    # Email notification
    if [[ -n "$NOTIFY_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
        local status_label="$(echo "$status" | sed 's/.*/\u&/')"
        local subject="ChefChek Backup ${status_label}: $(date '+%Y-%m-%d %H:%M')"
        echo "$message" | mail -s "$subject" "$NOTIFY_EMAIL"
    fi

    # Slack notification
    if [[ "$NOTIFY_SLACK" == "true" ]] && [[ -n "$SLACK_WEBHOOK" ]]; then
        local emoji="✅"
        if [[ "$status" == "failure" ]]; then
            emoji="❌"
        fi

        curl -s -X POST "$SLACK_WEBHOOK" \
             -H 'Content-Type: application/json' \
             -d "{\"text\": \"${emoji} ChefChek Backup ${status^}: ${message}\"}" \
             >/dev/null 2>&1 || true
    fi

    return 0
}

verify_backup() {
    log_info "Verifying backup..."

    local backup_dir="$BACKUP_ROOT/$BACKUP_TYPE"
    local latest_backup=$(ls -t ${backup_dir}/chefchek_${BACKUP_TYPE}_*.dump.gz 2>/dev/null | head -1)

    if [[ -z "$latest_backup" ]]; then
        log_error "No backup file found to verify"
        return 1
    fi

    # Check file exists and is not empty
    if [[ ! -s "$latest_backup" ]]; then
        log_error "Backup file is empty"
        return 1
    fi

    # Verify checksum
    if [[ -f "${latest_backup}.md5" ]]; then
        if md5sum -c "${latest_backup}.md5" >/dev/null 2>&1; then
            log_info "Checksum verification passed"
        else
            log_error "Checksum verification failed"
            return 1
        fi
    fi

    # Check backup size (minimum 1KB - empty DB produces small dumps)
    local backup_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null)
    local min_size=1024  # 1KB in bytes

    if [[ $backup_size -lt $min_size ]]; then
        log_error "Backup size suspiciously small: $backup_size bytes"
        return 1
    fi

    log_info "Backup verification passed"
    return 0
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --db-only)
                DB_ONLY=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                set -x
                shift
                ;;
            --type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Usage: $0 [--dry-run] [--db-only] [--verbose] [--type daily|weekly|monthly]"
                exit 1
                ;;
        esac
    done

    # Validate backup type
    if [[ "$BACKUP_TYPE" != "daily" ]] && [[ "$BACKUP_TYPE" != "weekly" ]] && [[ "$BACKUP_TYPE" != "monthly" ]]; then
        log_error "Invalid backup type: $BACKUP_TYPE (must be: daily, weekly, or monthly)"
        exit 1
    fi

    log_info "=========================================="
    log_info "ChefChek Backup Script - Starting"
    log_info "=========================================="
    log_info "Backup Type: $BACKUP_TYPE"
    log_info "Docker Mode: $USE_DOCKER"
    log_info "DB Only: $DB_ONLY"
    log_info "Dry Run: $DRY_RUN"

    # Pre-checks
    if ! check_disk_space; then
        send_notification "failure" "Insufficient disk space"
        exit 1
    fi

    if ! check_postgres_connection; then
        send_notification "failure" "PostgreSQL connection failed"
        exit 1
    fi

    if ! create_backup_dirs; then
        send_notification "failure" "Failed to create backup directories"
        exit 1
    fi

    # Backup execution
    if ! backup_database; then
        send_notification "failure" "Database backup failed"
        exit 1
    fi

    if ! backup_files; then
        log_warn "File backup failed (continuing)"
    fi

    # Verification
    if ! verify_backup; then
        send_notification "failure" "Backup verification failed"
        exit 1
    fi

    # Rotation
    if ! rotate_backups; then
        log_warn "Backup rotation failed (continuing)"
    fi

    # Upload
    if ! upload_to_s3; then
        log_warn "S3 upload failed (continuing)"
    fi

    log_info "=========================================="
    log_info "Backup completed successfully"
    log_info "=========================================="

    send_notification "success" "Backup completed: $BACKUP_TYPE"

    exit 0
}

# Run main
main "$@"