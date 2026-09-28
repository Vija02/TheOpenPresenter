--! Previous: sha1:1f171afc048b064e0b46333f02714a0ca10fa9c6
--! Hash: sha1:7d75af0f15b4e8537ea6f98549f30fdb214088ca

--! split: 1-current.sql
-- Enter migration here

--! split: 100-duplicate-project.sql
drop function if exists app_public.duplicate_project(uuid) cascade;
drop function if exists app_public.duplicate_project(uuid, text) cascade;

create function app_public.duplicate_project(project_id uuid, name text default null) returns app_public.projects as $$
declare
  v_source app_public.projects;
  v_project app_public.projects;
  v_name text;
  v_base_slug citext;
  v_slug citext;
  v_suffix int := 1;
begin
  select * into v_source from app_public.projects where id = project_id;

  if v_source.id is null then
    raise exception 'Project not found' using errcode = 'NTFND';
  end if;

  if v_source.organization_id not in (select app_public.current_user_member_organization_ids()) then
    raise exception 'You do not have access to this project' using errcode = 'DNIED';
  end if;

  v_name := coalesce(
    duplicate_project.name,
    case when v_source.name = '' then '' else v_source.name || ' (copy)' end
  );

  v_base_slug := v_source.slug || '-copy';
  v_slug := v_base_slug;

  while exists(
    select 1 from app_public.projects
    where organization_id = v_source.organization_id and slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into app_public.projects (
    organization_id,
    creator_user_id,
    name,
    slug,
    category_id,
    target_date,
    document
  ) values (
    v_source.organization_id,
    app_public.current_user_id(),
    v_name,
    v_slug,
    v_source.category_id,
    v_source.target_date,
    v_source.document
  ) returning * into v_project;

  insert into app_public.project_tags (project_id, tag_id)
  select v_project.id, pt.tag_id
  from app_public.project_tags pt
  where pt.project_id = v_source.id;

  insert into app_public.project_medias (project_id, media_id, plugin_id)
  select v_project.id, pm.media_id, pm.plugin_id
  from app_public.project_medias pm
  where pm.project_id = v_source.id;

  return v_project;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.duplicate_project(uuid, text) to :DATABASE_VISITOR;

comment on function app_public.duplicate_project(uuid, text) is
  E'Creates a copy of a project, including its document, tags and media links.';
