--! Previous: sha1:e162aeb29716d40c3aded5e7c565b28fec3a54fe
--! Hash: sha1:a3b9dcb50ff9292884783d89be2d8a33fe15434f

--! split: 100-current.sql
-- Revoke the raw UPDATE grant on screens.current_project_id so visitors cannot
-- bypass the same-org / public-project check enforced by
-- app_public.set_existing_project_to_screen. All assignment writes must now go
-- through that SECURITY DEFINER function.
revoke update(current_project_id) on app_public.screens from :DATABASE_VISITOR;

--! split: 200-screen-control-pending-unique.sql
-- Prevent a single guest session from spamming multiple pending control
-- requests on the same screen. The requestScreenControl mutation also
-- short-circuits when a pending row already exists; this partial unique index
-- acts as a DB-level safety net.
drop index if exists app_public.screen_control_requests_one_pending_per_session;
create unique index screen_control_requests_one_pending_per_session
  on app_public.screen_control_requests (screen_id, screen_guest_session_id)
  where status = 'pending';
