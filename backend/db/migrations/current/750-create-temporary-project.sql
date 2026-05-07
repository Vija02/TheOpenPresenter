create function app_public.create_temporary_project(
  screen_id uuid
) returns app_public.projects as $$
declare
  v_screen app_public.screens;
  v_project app_public.projects;
  v_slug text;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  select * into v_screen from app_public.screens where id = screen_id;
  if v_screen.id is null then
    raise exception 'Screen not found' using errcode = 'NTFND';
  end if;

  v_slug := 'temp-' || replace(gen_random_uuid()::text, '-', '');

  insert into app_public.projects (
    organization_id,
    creator_user_id,
    name,
    slug,
    is_temporary
  ) values (
    v_screen.organization_id,
    app_public.current_user_id(),
    'Temporary project',
    v_slug,
    true
  ) returning * into v_project;

  update app_public.screens
  set current_project_id = v_project.id
  where id = screen_id;

  return v_project;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.create_temporary_project(uuid) to :DATABASE_VISITOR;
