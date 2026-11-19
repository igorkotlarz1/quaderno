#!/bin/sh
# Runs backup.sh every day at $BACKUP_HOUR (local time, TZ), forever. Started by compose.
set -u
: "${BACKUP_HOUR:=3}"
echo "backup-loop: daily at ${BACKUP_HOUR}:00 (${TZ:-UTC})"
while true; do
  now=$(date +%s)
  next=$(date -d "today ${BACKUP_HOUR}:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow ${BACKUP_HOUR}:00" +%s)
  sleep $((next - now))
  backup.sh || echo "backup-loop: backup FAILED, will retry tomorrow" >&2
done
