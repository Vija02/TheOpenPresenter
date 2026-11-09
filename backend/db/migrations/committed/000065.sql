--! Previous: sha1:3981b9f2e72e30ff5cb375bee0d9409bf5dc88b1
--! Hash: sha1:82bd576f6618f66c9e9410ce9252dd2b410c827c

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop trigger if exists _900_cloud_sync_hint on app_public.screens;
drop trigger if exists _150_set_screen_code on app_public.screens;

--! split: 300-screens-cloud-sync.sql
/*
 * Screens sync two ways with the cloud, assignment included, matched by slug.
 */
comment on table app_public.screens is
  E'A persistent display identity in an organization. Configured once on the device, then any project can be assigned to it remotely.\n@cloudSync';

-- A screen created offline keeps its code and access settings when pushed.
grant insert(
  code,
  registered_guest_enabled,
  registered_guest_on_empty_policy,
  registered_guest_on_takeover_policy,
  registered_guest_on_takeover_after_seconds,
  anon_guest_enabled,
  anon_guest_on_empty_policy,
  anon_guest_on_takeover_policy,
  anon_guest_on_takeover_after_seconds,
  idle_policy,
  idle_after_seconds,
  unassign_after_idle_seconds,
  show_bar_on_idle
) on app_public.screens to :DATABASE_VISITOR;

/*
 * Codes are unique per server, and sync brings them from the other side. One
 * that is malformed or already taken here is not used: a new screen gets a
 * fresh code, an existing one keeps its own.
 */
create or replace function app_private.tg_screens__set_code() returns trigger as $$
begin
  if new.code is null
    or upper(new.code::text) !~ '^[2-9A-HJKMNP-Z]{4}$'
    or exists (
      select 1 from app_public.screens
      where code = new.code and id <> new.id
    )
  then
    new.code := coalesce(
      case when TG_OP = 'UPDATE' then old.code end,
      app_private.generate_screen_code()
    );
  else
    new.code := upper(new.code::text);
  end if;
  return new;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

create trigger _150_set_screen_code
  before insert or update of code on app_public.screens
  for each row
  execute function app_private.tg_screens__set_code();

select app_private.attach_cloud_sync_hints();
