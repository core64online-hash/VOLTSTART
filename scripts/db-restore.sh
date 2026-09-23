#!/usr/bin/env bash
# Відновлення з резервної копії у вказану БД (наявні обʼєкти замінюються).
#   TARGET_DATABASE_URL=postgresql://… scripts/db-restore.sh backups/voltstar-….dump
# Для production: спершу відновіть у тимчасову БД і перевірте (scripts/db-verify-restore.sh).
set -euo pipefail

FILE="${1:?Вкажіть файл резервної копії}"
: "${TARGET_DATABASE_URL:?Задайте TARGET_DATABASE_URL (куди відновлювати)}"
URL="${TARGET_DATABASE_URL%%\?*}"

if [[ -f "$FILE.sha256" ]]; then
  sha256sum --check --status "$FILE.sha256" || { echo "❌ Контрольна сума не збігається: $FILE"; exit 1; }
fi
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$URL" "$FILE"
echo "✅ Відновлено $FILE → ${URL##*@}"
