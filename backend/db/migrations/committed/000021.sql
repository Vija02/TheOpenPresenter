--! Previous: sha1:644b2667fd5ca5c64a6f22a57c53bec8c6b1d947
--! Hash: sha1:4309e7109f6ac5e9de3e2593ded8540d96058a30

--! split: 100-reset.sql
-- 200
drop policy if exists select_public on app_public.projects;

ALTER TABLE app_public.projects
  DROP COLUMN IF EXISTS is_public;

--! split: 200-public-projects.sql
ALTER TABLE app_public.projects
  ADD COLUMN is_public boolean default false;

create index on "app_public"."projects"("is_public");

-- If public, anyone can access
create policy select_public on app_public.projects for select using (is_public is true);

grant insert(is_public) on app_public.projects to :DATABASE_VISITOR;
grant update(is_public) on app_public.projects to :DATABASE_VISITOR;
