#!/usr/bin/env bash
# Перевірка бекапу: знімає копію, відновлює її в тимчасову БД і порівнює кількість рядків
# у ключових таблицях та стан міграцій. Нічого не змінює в робочій БД.
#   DATABASE_URL=postgresql://… scripts/db-verify-restore.sh
set -euo pipefail

: "${DATABASE_URL:?Задайте DATABASE_URL}"
SRC="${DATABASE_URL%%\?*}"
TMP_DB="voltstar_restore_check_$(date -u +%s)"
BASE="${SRC%/*}"   # URL без імені БД
TARGET="$BASE/$TMP_DB"
WORK="$(mktemp -d)"
trap 'psql "$BASE/postgres" -qc "DROP DATABASE IF EXISTS \"$TMP_DB\"" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

DATABASE_URL="$SRC" BACKUP_KEEP=1 "$(dirname "$0")/db-backup.sh" "$WORK" >/dev/null
FILE="$(ls -1 "$WORK"/voltstar-*.dump)"
psql "$BASE/postgres" -qc "CREATE DATABASE \"$TMP_DB\"" >/dev/null
TARGET_DATABASE_URL="$TARGET" "$(dirname "$0")/db-restore.sh" "$FILE" >/dev/null

TABLES=(User Organization Product Price InventoryItem "Order" OrderItem Payment Lead Deal AuditLog _prisma_migrations)
fail=0
for t in "${TABLES[@]}"; do
  a=$(psql "$SRC" -tAc "SELECT count(*) FROM \"$t\"")
  b=$(psql "$TARGET" -tAc "SELECT count(*) FROM \"$t\"")
  if [[ "$a" == "$b" ]]; then echo "  ✓ $t: $a"; else echo "  ✗ $t: $a ≠ $b"; fail=1; fi
done
[[ $fail -eq 0 ]] && echo "✅ Відновлення перевірено ($(du -h "$FILE" | cut -f1))" || { echo "❌ Розбіжності після відновлення"; exit 1; }
