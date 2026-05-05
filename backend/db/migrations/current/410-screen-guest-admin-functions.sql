create function app_public.create_screen_guest(
  organization_id uuid,
  display_name text,
  passcode text,
  email text default null
) returns app_public.screen_guests as $$
#variable_conflict use_variable
declare
  result app_public.screen_guests;
  v_user_id uuid := app_public.current_user_id();
begin
  if v_user_id is null
     or organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  if length(coalesce(passcode, '')) < 4 then
    raise exception 'Passcode must be at least 4 characters' using errcode = 'BADPC';
  end if;

  insert into app_public.screen_guests
    (organization_id, display_name, email, passcode_hash, created_by)
  values
    (organization_id, display_name, nullif(email, ''), crypt(passcode, gen_salt('bf')), v_user_id)
  returning * into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.create_screen_guest(uuid, text, text, text) to :DATABASE_VISITOR;

create function app_public.update_screen_guest(
  id uuid,
  display_name text default null,
  passcode text default null,
  email text default null,
  is_active boolean default null
) returns app_public.screen_guests as $$
#variable_conflict use_variable
declare
  result app_public.screen_guests;
  v_user_id uuid := app_public.current_user_id();
  v_entry app_public.screen_guests;
begin
  select sg.* into v_entry
  from app_public.screen_guests sg
  where sg.id = id;

  if v_entry is null then
    raise exception 'Screen guest not found' using errcode = 'NTFND';
  end if;
  if v_user_id is null
     or v_entry.organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  if passcode is not null and length(passcode) < 4 then
    raise exception 'Passcode must be at least 4 characters' using errcode = 'BADPC';
  end if;

  update app_public.screen_guests sg
  set display_name = coalesce(display_name, sg.display_name),
      email = case when email is null then sg.email else nullif(email, '') end,
      passcode_hash = case when passcode is null then sg.passcode_hash else crypt(passcode, gen_salt('bf')) end,
      is_active = coalesce(is_active, sg.is_active),
      updated_at = now()
  where sg.id = id
  returning sg.* into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.update_screen_guest(uuid, text, text, text, boolean) to :DATABASE_VISITOR;

create function app_public.delete_screen_guest(id uuid) returns uuid as $$
#variable_conflict use_variable
declare
  v_user_id uuid := app_public.current_user_id();
  v_entry app_public.screen_guests;
begin
  select sg.* into v_entry
  from app_public.screen_guests sg
  where sg.id = id;
  if v_entry is null then
    return id;
  end if;
  if v_user_id is null
     or v_entry.organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  delete from app_public.screen_guests sg where sg.id = id;
  return id;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.delete_screen_guest(uuid) to :DATABASE_VISITOR;
