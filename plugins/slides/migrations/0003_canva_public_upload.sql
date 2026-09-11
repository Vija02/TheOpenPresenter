-- ---------------------------------------------------------------------------
-- Allow anonymous Canva connections made through a public upload link.
--
-- The existing flow assumes a signed-in member, so both columns require a
-- user. A visitor holding an upload link has no user row, so the OAuth state
-- and the resulting connection must be able to record "no user".
--
-- The upload link the visitor came through is recorded instead, so a
-- connection can always be traced back to why it exists.
-- ---------------------------------------------------------------------------
alter table canva_oauth_state
  alter column user_id drop not null;

alter table canva_oauth_state
  add column if not exists upload_link_id uuid
    references upload_link (id) on delete cascade;

alter table canva_connection
  add column if not exists created_via_upload_link_id uuid
    references upload_link (id) on delete set null;

create index if not exists canva_oauth_state_upload_link_id_idx
  on canva_oauth_state (upload_link_id);
