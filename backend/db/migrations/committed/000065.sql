--! Previous: sha1:3981b9f2e72e30ff5cb375bee0d9409bf5dc88b1
--! Hash: sha1:2c8ea318603431bab75d6745dd9e7cda623a613c

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
-- Only sync may choose a code, so it is left out of GraphQL.
comment on column app_public.screens.code is
  E'@omit create\nShort, globally-unique code visitors can type at /connect to reach this screen''s control page';

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
 * Codes are unique per server. Only sync (app.cloud_sync) may bring one from
 * the other side; one that is malformed or already taken here is not used: a
 * new screen gets a fresh code, an existing one keeps its own.
 */
create or replace function app_private.tg_screens__set_code() returns trigger as $$
begin
  if new.code is null
    or current_setting('app.cloud_sync', true) is distinct from 'on'
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
