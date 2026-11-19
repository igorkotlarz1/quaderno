#!/bin/sh
# One backup: pg_dump into /backups (keeps the newest $KEEP_DUMPS), then restic to B2 if configured.
set -eu
: "${KEEP_DUMPS:=14}"
ts=$(date +%Y-%m-%d_%H%M)
out="/backups/quaderno_${ts}.dump"
pg_dump --format=custom --file="$out.part" && mv "$out.part" "$out"
echo "backup: $out ($(du -h "$out" | cut -f1))"

# Prune old local dumps, oldest first.
n=0
for f in $(ls -1t /backups/quaderno_*.dump); do
  n=$((n + 1))
  if [ "$n" -gt "$KEEP_DUMPS" ]; then
    echo "backup: pruning $f"
    unlink "$f"
  fi
done

if [ -n "${RESTIC_REPOSITORY:-}" ]; then
  restic cat config >/dev/null 2>&1 || restic init
  restic backup /backups --tag quaderno --quiet
  restic forget --tag quaderno --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune --quiet
  echo "backup: restic snapshot sent to $RESTIC_REPOSITORY"
else
  echo "backup: RESTIC_REPOSITORY is empty, off-site copy skipped"
fi
