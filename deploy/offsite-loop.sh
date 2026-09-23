#!/bin/sh
# Копії бекапів поза сервером: кожні OFFSITE_INTERVAL_SEC копіює нові файли з /backups
# у S3-сумісне сховище (Cloudflare R2, Backblaze B2, AWS S3, Wasabi…) через rclone
# і видаляє там копії, старші за OFFSITE_KEEP_DAYS.
#
# Вимкнено, доки не задано OFFSITE_S3_BUCKET. Якщо задано OFFSITE_CRYPT_PASSWORD, файли
# шифруються на сервері до відправлення (rclone crypt) — сховище бачить лише шифротекст.
#
# Відновлення (у терміналі контейнера offsite):
#   sh /deploy/offsite-loop.sh list                      — копії в зовнішньому сховищі
#   sh /deploy/offsite-loop.sh fetch voltstar-<дата>.dump — завантажити (і розшифрувати) у /backups/restore/
set -eu

CMD="${1:-loop}"
if [ -z "${OFFSITE_S3_BUCKET:-}" ]; then
  if [ "$CMD" != loop ]; then
    echo "OFFSITE_S3_BUCKET не задано — зовнішнє сховище не налаштоване" >&2
    exit 1
  fi
  echo "ℹ️  Зовнішні копії вимкнено (OFFSITE_S3_BUCKET не задано)"
  exec sleep 2147483647
fi

# Конфігурація rclone через змінні середовища (без файлу конфігурації).
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_OFFSITE_TYPE=s3
export RCLONE_CONFIG_OFFSITE_PROVIDER="${OFFSITE_S3_PROVIDER:-Other}"
export RCLONE_CONFIG_OFFSITE_ENDPOINT="${OFFSITE_S3_ENDPOINT:-}"
export RCLONE_CONFIG_OFFSITE_REGION="${OFFSITE_S3_REGION:-auto}"
export RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID="${OFFSITE_S3_ACCESS_KEY_ID:?задайте OFFSITE_S3_ACCESS_KEY_ID}"
export RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY="${OFFSITE_S3_SECRET_ACCESS_KEY:?задайте OFFSITE_S3_SECRET_ACCESS_KEY}"
# Бакет уже створено в кабінеті сховища; ключ може не мати права створювати бакети.
export RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET=true

TARGET="offsite:${OFFSITE_S3_BUCKET}/${OFFSITE_S3_PREFIX:-voltstar}"
if [ -n "${OFFSITE_CRYPT_PASSWORD:-}" ]; then
  export RCLONE_CONFIG_OFFSITECRYPT_TYPE=crypt
  export RCLONE_CONFIG_OFFSITECRYPT_REMOTE="$TARGET"
  export RCLONE_CONFIG_OFFSITECRYPT_FILENAME_ENCRYPTION=off
  RCLONE_CONFIG_OFFSITECRYPT_PASSWORD="$(rclone obscure "$OFFSITE_CRYPT_PASSWORD")"
  export RCLONE_CONFIG_OFFSITECRYPT_PASSWORD
  TARGET="offsitecrypt:"
fi

case "$CMD" in
  list)
    rclone lsl "$TARGET" --include 'voltstar-*.dump' | sort -k2,3
    exit 0
    ;;
  fetch)
    NAME="${2:?вкажіть файл: fetch voltstar-<дата>.dump}"
    case "$NAME" in voltstar-*.dump) ;; *) echo "Очікується назва voltstar-<дата>.dump" >&2; exit 2 ;; esac
    mkdir -p /backups/restore
    rclone copy "$TARGET" /backups/restore --include "/$NAME" --include "/$NAME.sha256" -v
    [ -f "/backups/restore/$NAME" ] || { echo "❌ $NAME не знайдено в зовнішньому сховищі" >&2; exit 1; }
    echo "✅ /backups/restore/$NAME — відновлення в контейнері backup: /scripts/db-restore.sh /backups/restore/$NAME"
    exit 0
    ;;
  loop) ;;
  *)
    echo "Невідома команда: $CMD (list | fetch <файл>)" >&2
    exit 2
    ;;
esac

INTERVAL="${OFFSITE_INTERVAL_SEC:-3600}"
KEEP_DAYS="${OFFSITE_KEEP_DAYS:-30}"
echo "☁️  Зовнішні копії → ${OFFSITE_S3_BUCKET}/${OFFSITE_S3_PREFIX:-voltstar}$([ -n "${OFFSITE_CRYPT_PASSWORD:-}" ] && echo ' (зашифровано)'), кожні ${INTERVAL} с, зберігаються ${KEEP_DAYS} дн."

while true; do
  # Лише завершені копії та їхні контрольні суми з кореня /backups (не *.part, що саме пишеться,
  # і не завантажені назад у restore/) і лише молодші за строк зберігання — інакше видалене
  # нижче знову завантажувалося б щогодини.
  if rclone copy /backups "$TARGET" --include '/voltstar-*.dump' --include '/voltstar-*.dump.sha256' \
       --max-age "${KEEP_DAYS}d" --immutable --stats-one-line --stats 0 -v 2>&1; then
    rclone delete "$TARGET" --min-age "${KEEP_DAYS}d" --include 'voltstar-*' -v 2>&1 || true
    echo "✅ Зовнішні копії синхронізовано $(date -u +%FT%TZ): $(rclone lsf "$TARGET" --include 'voltstar-*.dump' | wc -l) шт."
  else
    echo "❌ Не вдалося скопіювати бекапи в зовнішнє сховище $(date -u +%FT%TZ)" >&2
  fi
  sleep "$INTERVAL"
done
