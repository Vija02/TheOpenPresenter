--! Previous: sha1:97fa53fec16853003b364817956be881c700df79
--! Hash: sha1:47794e272808862d0295cdb52a0deffa65c88e30

--! split: 100-reset.sql
-- 200
drop function if exists app_private.tg_project_medias__cleanup_unused_media() cascade;
drop table if exists app_public.project_medias;

--! split: 200-project-medias.sql
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

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/

-- Function to handle cleanup of unused non-user-uploaded media
create or replace function app_private.tg_project_medias__cleanup_unused_media() returns trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_media_id uuid;
  v_is_user_uploaded boolean;
  v_has_other_project_medias boolean;
begin
  -- Get the media_id from the deleted row
  v_media_id := OLD.media_id;
  
  -- Check if the media is user uploaded
  select is_user_uploaded into v_is_user_uploaded
  from app_public.medias
  where id = v_media_id;
  
  -- Only proceed if media exists and is not user uploaded
  if v_is_user_uploaded is false then
    -- Check if there are any other project_medias referencing this media
    select exists(
      select 1
      from app_public.project_medias
      where media_id = v_media_id
    ) into v_has_other_project_medias;
    
    -- If no other project_medias reference this media, clean it up
    if not v_has_other_project_medias then
      perform graphile_worker.add_job(
        'medias__delete',
        json_build_object(
          'id', v_media_id
        )
      );
    end if;
  end if;
  
  return OLD;
end;
$$;

-- Create the trigger
create trigger _900_cleanup_unused_media
  after delete on app_public.project_medias
  for each row
  execute function app_private.tg_project_medias__cleanup_unused_media();
