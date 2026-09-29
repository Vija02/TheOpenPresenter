# Cloud Sync

Self-hosted instances mirror a cloud organization by **enumerating entities one
at a time**. Nothing is synced generically. If you add a new table, column or
document field and do not touch the sync code, it silently will not sync — no
error, no warning, no failing test.

**Whenever you add something persistent, check whether it needs syncing.** If it
does, the sync code needs editing in the same change.

## Where to look

- `backend/worker/src/tasks/cloud_connection__sync.ts` — orchestrates a run
- `backend/worker/src/tasks/cloud_connection__sync_media.ts` — media
- `backend/backend-shared/src/cloud/sync/` — per-entity implementations
- `apps/project/src/graphql/Model/Cloud/AllProjectMetadata.graphql` — what is
  requested from the remote. Easy to forget: a field absent here never reaches
  the sync code, so adding a column to both databases is not enough.

Synced today: categories, tags, project metadata, project documents, media.
Anything else does not sync.
