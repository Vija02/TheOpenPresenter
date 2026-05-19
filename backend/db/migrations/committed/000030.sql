--! Previous: sha1:01ad3c82f7ca1993a222e1df9c2fe9c6865f830d
--! Hash: sha1:866165b89cc78112e7c5d82ac29564873f8d21c9

--! split: 1-current.sql
create or replace function app_private.tg_screens__set_code() returns trigger as $$
begin
  -- Clients have no insert/update grant on this column, but be defensive
  -- against superuser inserts that omit it.
  if new.code is null then
    new.code := app_private.generate_screen_code();
  end if;
  return new;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;
