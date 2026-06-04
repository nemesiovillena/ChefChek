#!/bin/bash
# ChefChek Monthly Restore Test Script
# Performs automated restore test on staging/test database

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/chefchek}"
TEST_DB="${TEST_DB:-chefchek_test_restore}"
LOG_FILE="${LOG_FILE:-/var/log/chefchek-test-restore.log}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

DOCKER_CONTAINER="${DOCKER_CONTAINER:-chefchek-postgres-1}"
USE_DOCKER="${USE_DOCKER:-false}"

MIN_USER_COUNT=100
MIN_PRODUCT_COUNT=10

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

check_latest_backup() {
    log "INFO" "Finding latest backup..."

    local latest_backup=$(ls -t "$BACKUP_ROOT/daily"/*.dump.gz 2>/dev/null | head -1)

    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backup file found"
        return 1
    fi

    log "INFO" "Latest backup: $(basename "$latest_backup")"
    echo "$latest_backup"
}

create_test_database() {
    log "INFO" "Creating test database: $TEST_DB"

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    # Drop if exists
    $psql_cmd -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true

    # Create new
    $psql_cmd -c "CREATE DATABASE $TEST_DB;" 2>/dev/null || true

    log "INFO" "Test database created"
    return 0
}

restore_to_test_db() {
    local backup_file="$1"

    log "INFO" "Restoring backup to test database..."

    local backup_name=$(basename "$backup_file")

    # Decompress
    if [[ "$backup_file" =~ \.gz$ ]]; then
        log "INFO" "Decompressing backup..."
        local uncompressed="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$uncompressed"
        backup_file="$uncompressed"
    fi

    local pg_restore_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        docker cp "$backup_file" "${DOCKER_CONTAINER}:/tmp/test-restore.dump"
        pg_restore_cmd="docker exec $DOCKER_CONTAINER pg_restore -U $DB_USER -d $TEST_DB /tmp/test-restore.dump"
    else
        pg_restore_cmd="pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TEST_DB $backup_file"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    if $pg_restore_cmd 2>&1 | tee -a "$LOG_FILE"; then
        log "INFO" "Restore completed successfully"
        return 0
    else
        log "ERROR" "Restore failed"
        return 1
    fi
}

verify_data_integrity() {
    log "INFO" "Verifying data integrity..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -d $TEST_DB -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TEST_DB"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    # Check users
    local user_count=$($psql_cmd -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
    log "INFO" "Users: $user_count"

    if [[ $user_count -lt $MIN_USER_COUNT ]]; then
        log "ERROR" "User count too low: $user_count (min: $MIN_USER_COUNT)"
        return 1
    fi

    # Check products
    local product_count=$($psql_cmd -t -c "SELECT COUNT(*) FROM products;" 2>/dev/null | xargs || echo "0")
    log "INFO" "Products: $product_count"

    if [[ $product_count -lt $MIN_PRODUCT_COUNT ]]; then
        log "ERROR" "Product count too low: $product_count (min: $MIN_PRODUCT_COUNT)"
        return 1
    fi

    # Check orders
    local order_count=$($psql_cmd -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null | xargs || echo "0")
    log "INFO" "Orders: $order_count"

    # Check tenants
    local tenant_count=$($psql_cmd -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null | xargs || echo "0")
    log "INFO" "Tenants: $tenant_count"

    log "INFO" "Data integrity verified"
    return 0
}

cleanup_test_database() {
    log "INFO" "Cleaning up test database..."

    local psql_cmd

    if [[ "$USE_DOCKER" == "true" ]]; then
        psql_cmd="docker exec $DOCKER_CONTAINER psql -U $DB_USER -h localhost"
    else
        psql_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"
    fi

    if [[ "$DB_PASSWORD" != "" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi

    $psql_cmd -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true

    # Clean temp files
    rm -f /tmp/test-restore.dump 2>/dev/null || true

    log "INFO" "Cleanup completed"
    return 0
}

send_notification() {
    local status="$1"
    local message="$2"

    local slack_webhook="${SLACK_WEBHOOK:-}"
    local notify_email="${NOTIFY_EMAIL:-admin@chefchek.com}"

    # Slack
    if [[ -n "$slack_webhook" ]]; then
        local emoji="✅"
        [[ "$status" == "failure" ]] && emoji="❌"

        curl -s -X POST "$slack_webhook" \
             -H 'Content-Type: application/json' \
             -d "{\"text\": \"${emoji} ChefChek Restore Test ${status^}: ${message}\"}" \
             >/dev/null 2>&1 || true
    fi

    # Email
    if [[ -n "$notify_email" ]] && command -v mail >/dev/null 2>&1; then
        local subject="ChefChek Restore Test ${status^}: $(date '+%Y-%m-%d %H:%M')"
        echo "$message" | mail -s "$subject" "$notify_email"
    fi
}

main() {
    log "INFO" "=========================================="
    log "INFO" "Restore Test - Starting"
    log "INFO" "=========================================="

    # Get latest backup
    local latest_backup
    latest_backup=$(check_latest_backup) || exit 1

    # Create test database
    if ! create_test_database; then
        send_notification "failure" "Failed to create test database"
        exit 1
    fi

    # Restore backup
    if ! restore_to_test_db "$latest_backup"; then
        send_notification "failure" "Restore failed"
        cleanup_test_database
        exit 1
    fi

    # Verify data
    if ! verify_data_integrity; then
        send_notification "failure" "Data integrity check failed"
        cleanup_test_database
        exit 1
    fi

    # Cleanup
    cleanup_test_database

    log "INFO" "=========================================="
    log "INFO" "Restore test completed successfully"
    log "INFO" "=========================================="

    send_notification "success" "Monthly restore test passed"

    exit 0
}

main "$@"