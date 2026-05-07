create function app_private.current_session_can_control_screen(p_screen_id uuid) returns boolean as $$
  select
    exists(
      select 1 from app_public.screens s
      where s.id = p_screen_id
        and s.organization_id in (select app_public.current_user_member_organization_ids())
    )
    or
    exists(
      select 1 from app_public.screen_active_controllers ac
      where ac.screen_id = p_screen_id
        and ac.screen_guest_session_id = app_public.current_screen_guest_session_id()
    );
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

create function app_public.set_existing_project_to_screen(
  screen_id uuid,
  project_id uuid default null
) returns app_public.screens as $$
declare
  result app_public.screens;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  if project_id is not null then
    if not exists (
      select 1
      from app_public.screens s, app_public.projects p
      where s.id = screen_id
        and p.id = project_id
        and (
          p.organization_id = s.organization_id
          or p.organization_id in (select app_public.current_user_member_organization_ids())
          or p.is_public is true
        )
    ) then
      raise exception 'Project not accessible' using errcode = 'NTFND';
    end if;
  end if;

  update app_public.screens
  set current_project_id = project_id
  where id = screen_id
  returning * into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.set_existing_project_to_screen(uuid, uuid) to :DATABASE_VISITOR;
