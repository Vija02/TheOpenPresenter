--! Previous: sha1:a3b9dcb50ff9292884783d89be2d8a33fe15434f
--! Hash: sha1:01ad3c82f7ca1993a222e1df9c2fe9c6865f830d

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
-- 900
drop function if exists app_public.screen_by_code(text) cascade;
drop type if exists app_public.screen_by_code_result cascade;

-- 300
drop trigger if exists _150_set_screen_code on app_public.screens;
drop function if exists app_private.tg_screens__set_code() cascade;
drop function if exists app_private.generate_screen_code() cascade;

drop index if exists app_public.screens_code_idx;
alter table app_public.screens drop column if exists code;

--! split: 300-screens-code.sql
/*====================================*/
/*============== COLUMN ==============*/
/*====================================*/
alter table app_public.screens
  add column code citext;

/*====================================*/
/*============ HELPER FN =============*/
/*====================================*/
create function app_private.generate_screen_code() returns text as $$
declare
  -- Crockford-style alphabet minus U (kept simple): no 0, 1, I, L, O.
  v_chars constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_len   constant int  := length(v_chars);
  v_code  text;
  v_tries int := 0;
begin
  loop
    v_code := '';
    for _i in 1..4 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * v_len)::int, 1);
    end loop;
    exit when not exists (select 1 from app_public.screens where code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 1000 then
      raise exception 'Unable to generate unique screen code after 1000 attempts';
    end if;
  end loop;
  return v_code;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

/*====================================*/
/*============= BACKFILL =============*/
/*====================================*/
-- Per-row loop so each generated value is visible to subsequent uniqueness
-- checks within the same migration.
do $$
declare
  r record;
begin
  for r in select id from app_public.screens where code is null loop
    update app_public.screens
       set code = app_private.generate_screen_code()
     where id = r.id;
  end loop;
end $$;

alter table app_public.screens
  alter column code set not null;

create unique index screens_code_idx on app_public.screens (code);

/*====================================*/
/*============= TRIGGER ==============*/
/*====================================*/
create function app_private.tg_screens__set_code() returns trigger as $$
begin
  -- Clients have no insert/update grant on this column, but be defensive
  -- against superuser inserts that omit it.
  if new.code is null then
    new.code := app_private.generate_screen_code();
  end if;
  return new;
end;
$$ language plpgsql volatile;

create trigger _150_set_screen_code
  before insert on app_public.screens
  for each row
  execute function app_private.tg_screens__set_code();

/*====================================*/
/*============= COMMENT ==============*/
/*====================================*/
comment on column app_public.screens.code is
  E'Short, globally-unique code visitors can type at /connect to reach this screen''s control page';

-- No grant on insert(code) or update(code): the column is read-only via the API.

--! split: 900-screen-by-code.sql
create type app_public.screen_by_code_result as (
  organization_slug citext,
  screen_slug       citext
);

create function app_public.screen_by_code(p_code text)
  returns app_public.screen_by_code_result
as $$
  select o.slug, s.slug
    from app_public.screens s
    join app_public.organizations o on o.id = s.organization_id
   where s.code = p_code
   limit 1;
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.screen_by_code(text) to :DATABASE_VISITOR;

comment on function app_public.screen_by_code(text) is
  E'Resolve a screen access code to the slugs needed to navigate to its control page. Returns null when the code does not match any screen.';
