alter table app_public.projects
  add column if not exists is_temporary boolean not null default false;

comment on column app_public.projects.is_temporary is
  E'True when this project was created up by a screen guest user';

create index if not exists projects_is_temporary_idx
  on app_public.projects(is_temporary);
