-- Keeps track of which projects are using which media files
create table app_public.project_medias (
  project_id uuid not null references app_public.projects(id) on delete cascade,
  media_id uuid not null references app_public.medias(id) on delete cascade,
  -- Store plugin_id since it's the actual owner inside a project
  plugin_id uuid not null,

  created_at timestamptz not null default now()
);

create unique index on "app_public"."project_medias"("project_id", "media_id", "plugin_id");
create index on "app_public"."project_medias"("project_id");
create index on "app_public"."project_medias"("media_id");
create index on "app_public"."project_medias"("plugin_id");

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.project_medias enable row level security;
-- Policies
create policy select_own on app_public.project_medias for select using (app_public.current_user_can_access_project(project_id));
create policy insert_own ON app_public.project_medias for insert with check (app_public.current_user_can_access_project(project_id));
create policy delete_own on app_public.project_medias for delete using (app_public.current_user_can_access_project(project_id));

-- Grants
grant select on app_public.project_medias to :DATABASE_VISITOR;
grant insert(project_id, media_id, plugin_id) on app_public.project_medias to :DATABASE_VISITOR;
grant delete on app_public.project_medias to :DATABASE_VISITOR;
