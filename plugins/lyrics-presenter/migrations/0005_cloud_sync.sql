-- Songs edited on both sides keep the local edit as a "(conflicted copy)".
comment on table saved_song is E'@cloudSync\n@cloudSyncCopyLabel title';
comment on table setlist_source is E'@cloudSync';

-- Add updated_at so we can sync it
alter table recent_song add column updated_at timestamptz not null default now();
update recent_song set updated_at = created_at;

-- Never edited, so a conflict can only be a duplicate
comment on table recent_song is E'@cloudSync\n@cloudSyncConflict cloudWins';
