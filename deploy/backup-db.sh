#!/usr/bin/env bash
# ==============================================================================
# Aylem Learning Student Portal — PostgreSQL Backup Script
# Performs compressed pg_dump and enforces a 14-day retention policy.
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/aylem-portal"
DB_NAME="aylem_portal"
DB_USER="aylem_app"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/aylem_portal_${DATE_TAG}.sql.gz"
RETENTION_DAYS=14

# Ensure backup directory exists with restricted permissions
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting PostgreSQL backup for ${DB_NAME}..."

# Export compressed dump
pg_dump -U "${DB_USER}" -h 127.0.0.1 "${DB_NAME}" | gzip > "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"

echo "[$(date -Iseconds)] Backup created successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than retention window
echo "[$(date -Iseconds)] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "aylem_portal_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date -Iseconds)] Backup routine completed."
