#!/bin/sh
# REAL restore: replaces the live database with a dump. Stop the api first (see docs/runbook/m2.md).
set -eu
dump=${1:?usage: restore.sh /backups/quaderno_YYYY-MM-DD_HHMM.dump}
printf 'This REPLACES all data in %s with %s. Type YES: ' "$PGDATABASE" "$dump"
read -r answer
[ "$answer" = "YES" ] || { echo "aborted"; exit 1; }
pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE" "$dump"
echo "restore: done"
