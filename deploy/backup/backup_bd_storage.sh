#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-$SCRIPT_DIR/backup.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE"
  echo "Copia backup.env.example a backup.env y completa los valores."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(
  PGHOST
  PGPORT
  PGDATABASE
  PGUSER
  PGPASSWORD
  STORAGE_PATH
  BACKUP_DIR
  RETENTION_DAYS
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Falta variable obligatoria: $var_name"
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"
LOG_FILE="$BACKUP_DIR/backup.log"

{
  echo "=================================================="
  echo "Inicio backup: $(date '+%Y-%m-%d %H:%M:%S')"

  timestamp="$(date '+%Y%m%d_%H%M%S')"
  target_dir="$BACKUP_DIR/$timestamp"
  mkdir -p "$target_dir"

  export PGPASSWORD
  pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="$target_dir/db_${PGDATABASE}.dump"

  if [[ ! -d "$STORAGE_PATH" ]]; then
    echo "No existe STORAGE_PATH: $STORAGE_PATH"
    exit 1
  fi

  tar -czf "$target_dir/storage.tar.gz" -C "$(dirname "$STORAGE_PATH")" "$(basename "$STORAGE_PATH")"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$target_dir/"* >"$target_dir/SHA256SUMS.txt"
  else
    shasum -a 256 "$target_dir/"* >"$target_dir/SHA256SUMS.txt"
  fi

  ln -sfn "$target_dir" "$BACKUP_DIR/latest"

  find "$BACKUP_DIR" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name "20*" \
    -mtime "+$RETENTION_DAYS" \
    -exec rm -rf {} \;

  echo "Backup OK: $target_dir"
  echo "Fin backup: $(date '+%Y-%m-%d %H:%M:%S')"
} >>"$LOG_FILE" 2>&1

