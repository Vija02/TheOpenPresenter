--! Previous: sha1:fb4107190329d84649d5de74a6e3fd7eaddc8109
--! Hash: sha1:d9999a386e75a0cd755ed6c2852f8921f5bfdf5b

--! split: 100-reset.sql
-- Drops everything the rest of this migration creates, in reverse order.
drop function if exists app_public.medias_is_font_stylesheet(app_public.medias);
drop function if exists app_public.organization_fonts(uuid);
drop function if exists app_public.media_font_metadata_css_url(app_public.media_font_metadata);
drop table if exists app_public.media_font_metadata;
drop function if exists app_hidden.media_organization_id(uuid);
drop function if exists app_hidden.is_font_of_organization(uuid, uuid);

--! split: 200-media-font-metadata.sql
create table app_public.media_font_metadata (
  font_media_id uuid primary key not null references app_public.medias(id) on delete cascade,
  -- The CSS family name, as written in the stylesheet and in style.fontFamily
  family text not null check (length(family) between 1 and 200),
  category text not null default 'sans' check (category in ('sans', 'serif', 'display', 'mono')),
  source text not null check (source in ('google', 'upload', 'system')),
  created_at timestamptz not null default now()
);

comment on table app_public.media_font_metadata is
  E'A font family available to the organization that owns the stylesheet media.';

create function app_hidden.is_font_of_organization(media_id uuid, organization_id uuid) returns boolean as $$
  select exists (
    select 1
    from app_public.medias m
    join app_public.media_font_metadata f on f.font_media_id = m.id
    where m.id = is_font_of_organization.media_id
      and m.organization_id = is_font_of_organization.organization_id
  );
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_hidden.is_font_of_organization(uuid, uuid) to :DATABASE_VISITOR;

alter table app_public.media_font_metadata enable row level security;

create policy select_own_media on app_public.media_font_metadata for select using (
  app_public.current_user_can_access_media(font_media_id)
  or exists (
    select 1
    from (select distinct p.organization_id from app_public.projects p) visible
    where app_hidden.is_font_of_organization(font_media_id, visible.organization_id)
  )
);

grant select on app_public.media_font_metadata to :DATABASE_VISITOR;

-- Where the browser loads the family's stylesheet from. SECURITY DEFINER
-- because guests cannot read `medias`; it is only reachable through a row
-- the caller could already see.
create function app_public.media_font_metadata_css_url(f app_public.media_font_metadata) returns text as $$
  select '/media/data/' || m.media_name from app_public.medias m where m.id = f.font_media_id;
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.media_font_metadata_css_url(app_public.media_font_metadata) to :DATABASE_VISITOR;

-- The fonts of an organization, alphabetically
create function app_public.organization_fonts(organization_id uuid) returns setof app_public.media_font_metadata as $$
  select f.*
  from app_public.media_font_metadata f
  where app_hidden.is_font_of_organization(f.font_media_id, organization_fonts.organization_id)
  order by lower(f.family);
$$ language sql stable;

grant execute on function app_public.organization_fonts(uuid) to :DATABASE_VISITOR;

comment on function app_public.organization_fonts(uuid) is
  E'The font families available to an organization.';

-- Whether a media is a font family's stylesheet
create function app_public.medias_is_font_stylesheet(m app_public.medias) returns boolean as $$
  select exists (
    select 1 from app_public.media_font_metadata f where f.font_media_id = m.id
  );
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.medias_is_font_stylesheet(app_public.medias) to :DATABASE_VISITOR;
