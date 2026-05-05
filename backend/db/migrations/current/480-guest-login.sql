create type app_public.screen_login_info as (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  screen_id uuid,
  screen_name text,
  screen_slug text,
  allows_anon boolean,
  allows_registered boolean
);

create function app_public.screen_login_metadata(
  p_org_slug text,
  p_screen_slug text
) returns app_public.screen_login_info as $$
  select
    o.id,
    o.name,
    o.slug,
    s.id,
    s.name,
    s.slug,
    s.anon_guest_enabled as allows_anon,
    s.registered_guest_enabled as allows_registered
  from app_public.screens s
  join app_public.organizations o on o.id = s.organization_id
  where o.slug = p_org_slug
    and s.slug = p_screen_slug
    and (s.anon_guest_enabled or s.registered_guest_enabled);
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.screen_login_metadata(text, text) to :DATABASE_VISITOR;

comment on function app_public.screen_login_metadata(text, text) is
  E'Get the data required to login as guest.';

create function app_private.authenticate_screen_guest(
  p_organization_id uuid,
  p_secret text
) returns app_public.screen_guest_sessions as $$
declare
  v_entry app_public.screen_guests;
  v_session app_public.screen_guest_sessions;
begin
  select * into v_entry
  from app_public.screen_guests
  where organization_id = p_organization_id
    and is_active
    and (expires_at is null or expires_at > now())
    and passcode_hash = crypt(p_secret, passcode_hash)
  limit 1;

  if v_entry is null then
    raise exception 'Unrecognized email or passcode' using errcode = 'CREDS';
  end if;

  insert into app_public.screen_guest_sessions
    (organization_id, kind, display_name, screen_guest_id)
  values
    (p_organization_id, 'registered', v_entry.display_name, v_entry.id)
  returning * into v_session;

  return v_session;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;