ALTER TABLE app_public.projects
  ADD COLUMN cloud_connection_id uuid null,
  ADD COLUMN cloud_last_updated timestamptz null,
  ADD COLUMN cloud_should_sync boolean null,
  ADD COLUMN cloud_project_id uuid null;

create index on "app_public"."projects"("cloud_connection_id");
create unique index on "app_public"."projects"("organization_id", "cloud_project_id");