#!/bin/bash
# ChefChek Backup Verification Script
# Verifies backup integrity, size, and accessibility

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/chefchek}"
LOG_FILE="${LOG_FILE:-/var/log/chefchek-verify.log}"
MIN_SIZE_MB=100

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

verify_checksums() {
    log "INFO" "Verifying backup checksums..."

    local checksum_dir="$BACKUP_ROOT/checksums"
    local failed=0

    if [[ ! -d "$checksum_dir" ]]; then
        log "ERROR" "Checksum directory not found: $checksum_dir"
        return 1
    fi

    for checksum_file in "$checksum_dir"/*.md5; do
        if [[ -f "$checksum_file" ]]; then
            local backup_file=$(basename "$checksum_file" .md5)

            # Find backup file in any backup type directory
            local backup_path=$(find "$BACKUP_ROOT" -name "$backup_file" -type f 2>/dev/null | head -1)

            if [[ -z "$backup_path" ]]; then
                log "WARN" "Backup file not found for checksum: $backup_file"
                continue
            fi

            # Verify checksum (need to be in same directory as backup file)
            local backup_dir=$(dirname "$backup_path")
            local temp_checksum="$backup_dir/temp.md5"
            cp "$checksum_file" "$temp_checksum"
            cd "$backup_dir"

            if md5sum -c "temp.md5" >/dev/null 2>&1; then
                log "INFO" "✓ $backup_file"
            else
                log "ERROR" "✗ $backup_file - Checksum verification failed"
                failed=$((failed + 1))
            fi

            rm -f "$temp_checksum"
            cd - >/dev/null
        fi
    done

    if [[ $failed -gt 0 ]]; then
        log "ERROR" "$failed backup(s) failed checksum verification"
        return 1
    fi

    log "INFO" "All checksums verified successfully"
    return 0
}

verify_backup_sizes() {
    log "INFO" "Verifying backup sizes..."

    local failed=0
    local min_size_bytes=$((MIN_SIZE_MB * 1024 * 1024))

    for backup_file in "$BACKUP_ROOT"/daily/*.dump.gz "$BACKUP_ROOT"/weekly/*.dump.gz "$BACKUP_ROOT"/monthly/*.dump.gz; do
        if [[ -f "$backup_file" ]]; then
            local size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)

            if [[ $size -lt $min_size_bytes ]]; then
                log "WARN" "$(basename "$backup_file") - Size suspiciously small: $(($size / 1024 / 1024))MB"
                failed=$((failed + 1))
            else
                log "INFO" "✓ $(basename "$backup_file") - $(($size / 1024 / 1024))MB"
            fi
        fi
    done

    if [[ $failed -gt 0 ]]; then
        log "WARN" "$failed backup(s) have suspicious sizes"
    fi

    return 0
}

list_backups() {
    log "INFO" "Backup inventory:"

    local daily_count=$(find "$BACKUP_ROOT/daily" -name "*.dump.gz" -type f 2>/dev/null | wc -l)
    local weekly_count=$(find "$BACKUP_ROOT/weekly" -name "*.dump.gz" -type f 2>/dev/null | wc -l)
    local monthly_count=$(find "$BACKUP_ROOT/monthly" -name "*.dump.gz" -type f 2>/dev/null | wc -l)

    log "INFO" "Daily backups: $daily_count"
    log "INFO" "Weekly backups: $weekly_count"
    log "INFO" "Monthly backups: $monthly_count"

    # Show latest backups
    log "INFO" "Latest daily backup:"
    ls -lt "$BACKUP_ROOT/daily"/*.dump.gz 2>/dev/null | head -1 || log "INFO" "None"
}

main() {
    log "INFO" "=========================================="
    log "INFO" "Backup Verification - Starting"
    log "INFO" "=========================================="

    list_backups

    if ! verify_checksums; then
        log "ERROR" "Checksum verification failed"
        exit 1
    fi

    if ! verify_backup_sizes; then
        log "WARN" "Size verification completed with warnings"
    fi

    log "INFO" "=========================================="
    log "INFO" "Backup verification completed"
    log "INFO" "=========================================="

    exit 0
}

main "$@"