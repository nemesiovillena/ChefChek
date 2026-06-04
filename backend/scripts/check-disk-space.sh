#!/bin/bash
# ChefChek Disk Space Monitoring Script
# Monitors disk usage and sends alerts when space is low

set -euo pipefail

# Configuration
MIN_DISK_PERCENT=20
ALERT_THRESHOLD=90
CHECK_PATHS=(
    "/var/backups/chefchek"
    "/var/lib/postgresql"
    "/var/lib/docker"
)

# Notifications
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-admin@chefchek.com}"

check_disk_space() {
    local path="$1"
    local percent_used df_output available_gb total_gb

    # Get disk usage
    df_output=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//')

    if [[ -z "$df_output" ]]; then
        echo "ERROR: Could not get disk usage for $path"
        return 1
    fi

    percent_used=$df_output
    available_gb=$(df -BG "$path" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//')
    total_gb=$(df -BG "$path" 2>/dev/null | awk 'NR==2 {print $2}' | sed 's/G//')

    echo "Disk space check for: $path"
    echo "  Used: ${percent_used}%"
    echo "  Available: ${available_gb}GB / ${total_gb}GB"

    # Check if space is low
    local available_percent=$((100 - percent_used))

    if [[ $available_percent -lt $MIN_DISK_PERCENT ]]; then
        local message="ALERT: Disk space critically low on $(hostname)! Path: $path, Available: ${available_percent}% (${available_gb}GB)"
        echo "❌ $message"
        send_alert "$message"
        return 1
    elif [[ $percent_used -gt $ALERT_THRESHOLD ]]; then
        local message="WARNING: Disk usage high on $(hostname). Path: $path, Used: ${percent_used}%"
        echo "⚠️  $message"
        send_alert "$message"
        return 0
    else
        echo "✓ Disk space OK"
        return 0
    fi
}

send_alert() {
    local message="$1"

    # Slack alert
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
             -H 'Content-Type: application/json' \
             -d "{\"text\": \"🚨 $message\"}" \
             >/dev/null 2>&1 || true
    fi

    # Email alert
    if [[ -n "$NOTIFY_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "⚠️ ChefChek Disk Space Alert" "$NOTIFY_EMAIL"
    fi
}

main() {
    local has_issues=0

    echo "=========================================="
    echo "ChefChek Disk Space Check"
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Hostname: $(hostname)"
    echo "=========================================="
    echo ""

    for path in "${CHECK_PATHS[@]}"; do
        if [[ -d "$path" ]]; then
            echo ""
            check_disk_space "$path" || has_issues=1
        else
            echo "WARNING: Path does not exist: $path"
        fi
    done

    echo ""
    echo "=========================================="

    if [[ $has_issues -eq 1 ]]; then
        echo "Status: CRITICAL - Disk space issues detected"
        exit 1
    else
        echo "Status: OK - All disk space checks passed"
        exit 0
    fi
}

main "$@"