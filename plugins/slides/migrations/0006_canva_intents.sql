-- ---------------------------------------------------------------------------
-- Canva sign-ins started from a local install (Studio). The sign-in runs in the
-- system browser on the cloud, and the integration intent it belongs to is how
-- the local install learns the result.
-- ---------------------------------------------------------------------------
alter table canva_oauth_state
  add column if not exists intent_id text;
