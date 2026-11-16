--! Previous: sha1:2c8ea318603431bab75d6745dd9e7cda623a613c
--! Hash: sha1:713a8459ee9a1a3193b5499121d594e79678eaa0

--! split: 1-current.sql
-- Enter migration here

--! split: 100-screen-assignment-sync.sql
/*
 * The cloud applies a pushed screen with the member's own grants. Without
 * update on current_project_id, presenting to a screen offline never reached
 * the cloud: the column was skipped and the push still counted as applied.
 *
 * GraphQL keeps assigning through set_existing_project_to_screen, which checks
 * the project, so the column stays out of the screen patch.
 */
comment on column app_public.screens.current_project_id is
  E'Project currently shown on this screen, or NULL if idle.\n@omit update';

grant update(current_project_id) on app_public.screens to :DATABASE_VISITOR;
