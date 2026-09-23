#!/usr/bin/env bash
# Резервна копія PostgreSQL (формат custom, стиснений) з ротацією.
#   DATABASE_URL=postgresql://… scripts/db-backup.sh [каталог]   (типово: ./backups)
# Змінні: BACKUP_KEEP — скільки останніх копій лишати (типово 14).
set -euo pipefail

: "${DATABASE_URL:?Задайте DATABASE_URL}"
DIR="${1:-./backups}"
KEEP="${BACKUP_KEEP:-14}"
# pg_dump не розуміє Prisma-параметр ?schema=… — прибираємо query-рядок.
URL="${DATABASE_URL%%\?*}"

mkdir -p "$DIR"
FILE="$DIR/voltstar-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$FILE.part" "$URL"
mv "$FILE.part" "$FILE"
# Контрольна сума — щоб перед відновленням переконатися, що файл не пошкоджено.
sha256sum "$FILE" > "$FILE.sha256"
echo "✅ $FILE ($(du -h "$FILE" | cut -f1))"

# Ротація: лишаємо KEEP найновіших.
ls -1t "$DIR"/voltstar-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old" "$old.sha256"
  echo "🗑  видалено стару копію $old"
done
