#!/bin/sh
# VocalIA Data Backup Script v1.0
# Backs up /vocalia-data volume daily with 7-day retention
# Designed for cron: 0 2 * * * /docker/vocalia/backup.sh >> /vocalia-data/monitoring/backup.log 2>&1

set -e

BACKUP_DIR="/vocalia-data/backups"
DATA_DIR="/vocalia-data"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/vocalia-data-${DATE}.tar.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Create compressed backup (exclude backups dir itself and monitoring logs)
tar czf "${BACKUP_FILE}" \
  --exclude="vocalia-data/backups" \
  --exclude="vocalia-data/monitoring/*.log" \
  --exclude="vocalia-data/monitoring/*.jsonl" \
  -C / vocalia-data 2>/dev/null

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Rotate: delete backups older than RETENTION_DAYS
DELETED=0
find "${BACKUP_DIR}" -name "vocalia-data-*.tar.gz" -mtime +${RETENTION_DAYS} -type f | while read f; do
  rm -f "$f"
  DELETED=$((DELETED + 1))
  echo "[$(date -Iseconds)] Deleted old backup: $(basename $f)"
done

# Report
TOTAL=$(ls -1 "${BACKUP_DIR}"/vocalia-data-*.tar.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${TOTAL} backups, total ${TOTAL_SIZE}"
