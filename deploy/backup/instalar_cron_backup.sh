#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_bd_storage.sh"
BACKUP_ENV="$SCRIPT_DIR/backup.env"

if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "No existe script de backup: $BACKUP_SCRIPT"
  exit 1
fi

if [[ ! -f "$BACKUP_ENV" ]]; then
  echo "No existe archivo de entorno: $BACKUP_ENV"
  echo "Copia backup.env.example a backup.env"
  exit 1
fi

chmod +x "$BACKUP_SCRIPT"

CRON_JOB="0 2 * * * $BACKUP_SCRIPT $BACKUP_ENV"

{
  crontab -l 2>/dev/null | grep -v "backup_bd_storage.sh" || true
  echo "$CRON_JOB"
} | crontab -

echo "Cron instalado: $CRON_JOB"
