#!/bin/sh
# Бекапи за розкладом у контейнері postgres: одразу після старту, далі кожні BACKUP_INTERVAL_SEC.
# Копії з контрольними сумами — у томі /backups (ротація BACKUP_KEEP). Для копій поза сервером
# змонтуйте /backups на зовнішнє сховище або синхронізуйте його (rclone/restic) окремим завданням.
set -eu
INTERVAL="${BACKUP_INTERVAL_SEC:-86400}"
while true; do
  if /scripts/db-backup.sh /backups; then
    date -u +%FT%TZ > /backups/.last-success
  else
    echo "❌ Резервна копія не вдалася $(date -u +%FT%TZ)" >&2
  fi
  sleep "$INTERVAL"
done
