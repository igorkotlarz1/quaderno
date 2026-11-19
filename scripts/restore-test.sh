#!/bin/sh
# Trial restore: loads the newest dump into a throwaway database, compares row counts
# with the live one, then drops the throwaway database. Never touches the live data.
set -eu
dump=${1:-$(ls -1t /backups/quaderno_*.dump 2>/dev/null | head -n 1)}
if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "restore-test: no dump in /backups (run backup.sh first)" >&2
  exit 1
fi
tmp=quaderno_restore_test
dropdb --if-exists "$tmp"
createdb "$tmp"
pg_restore --no-owner --dbname="$tmp" "$dump"
count() {
  psql -d "$1" -tAc "select (select count(*) from lessons where deleted_at is null)||' '||(select count(*) from entries)||' '||(select count(*) from verbs)||' '||(select count(*) from assessments)"
}
live=$(count "$PGDATABASE")
restored=$(count "$tmp")
dropdb "$tmp"
echo "restore-test: dump      $dump"
echo "restore-test: live      lessons/entries/verbs/assessments = $live"
echo "restore-test: restored  lessons/entries/verbs/assessments = $restored"
if [ "$live" = "$restored" ]; then
  echo "restore-test: OK"
else
  echo "restore-test: DIFFERENT (normal if something was typed after the backup)"
  exit 2
fi
