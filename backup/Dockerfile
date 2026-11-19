# pg_dump 17 (same version as the database) + restic for off-site copies to Backblaze B2.
# restic and its CA bundle come from the official restic image, so no package manager is needed.
FROM restic/restic:0.18.0 AS restic

FROM pgvector/pgvector:pg17
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY --from=restic /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY scripts/backup.sh scripts/backup-loop.sh scripts/restore-test.sh scripts/restore.sh /usr/local/bin/
ENTRYPOINT []
CMD ["backup-loop.sh"]
