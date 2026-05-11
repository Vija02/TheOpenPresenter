create function app_public.release_screen_control(
  screen_id uuid
) returns app_public.screens as $$
declare
  result app_public.screens;
  guest_id uuid;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  -- Remove active controller
  delete from app_public.screen_active_controllers ac
  where ac.screen_id = release_screen_control.screen_id
  returning ac.screen_guest_session_id into guest_id;

  if guest_id is not null then
    -- Revoke session too
    delete from app_public.screen_guest_sessions where id = guest_id;
  end if;
  
  update app_public.screens
  set current_project_id = null
  where id = release_screen_control.screen_id
  returning * into result;

  if not found then
    raise exception 'Screen not found' using errcode = 'NTFND';
  end if;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.release_screen_control(uuid) to :DATABASE_VISITOR;
