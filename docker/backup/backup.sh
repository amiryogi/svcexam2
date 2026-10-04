#!/bin/sh
# Nightly MySQL backup: dump -> gzip -> AES-256 encrypt -> /backups, keep RETENTION_DAYS.
# Restore: openssl enc -d -aes-256-cbc -pbkdf2 -in FILE.sql.gz.enc -pass env:BACKUP_PASSPHRASE | gunzip | mysql -h mysql -u root -p "$MYSQL_DATABASE"
set -eu

: "${MYSQL_DATABASE:?}" "${MYSQL_ROOT_PASSWORD:?}" "${BACKUP_PASSPHRASE:?}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"

run_backup() {
  ts="$(date +%Y%m%d-%H%M%S)"
  out="/backups/${MYSQL_DATABASE}-${ts}.sql.gz.enc"
  echo "[backup] dumping ${MYSQL_DATABASE} -> ${out}"
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -h mysql -u root \
    --single-transaction --routines --triggers --set-gtid-purged=OFF "$MYSQL_DATABASE" \
    | gzip -9 \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "${out}.tmp"
  mv "${out}.tmp" "$out"
  find /backups -name "${MYSQL_DATABASE}-*.sql.gz.enc" -mtime +"$RETENTION_DAYS" -delete
  echo "[backup] done ($(du -h "$out" | cut -f1))"
}

if [ "${1:-}" = "--now" ]; then
  run_backup
  exit 0
fi

echo "[backup] scheduler started; daily at ${BACKUP_HOUR}:00"
while true; do
  if [ "$(date +%H)" -eq "$BACKUP_HOUR" ]; then
    run_backup || echo "[backup] FAILED"
    sleep 3700
  fi
  sleep 300
done
