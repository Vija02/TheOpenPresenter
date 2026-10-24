--! Previous: sha1:43eadb4c8d5c02a2cace33e795a244f98309d006
--! Hash: sha1:c7e6be1748f7b26ee8e430c31219ed1e3f72708f

--! split: 100-current.sql
drop function if exists app_public.project_by_org_and_slug(text, text);
drop function if exists app_hidden.organization_id_by_slug(text);

-- Only maps a slug to an id
create function app_hidden.organization_id_by_slug(p_slug text) returns uuid as $$
  select id from app_public.organizations where slug = p_slug;
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_hidden.organization_id_by_slug(text) to :DATABASE_VISITOR;

create function app_public.project_by_org_and_slug(
  p_org_slug text,
  p_project_slug text
) returns app_public.projects as $$
  select p.*
  from app_public.projects p
  where p.organization_id = app_hidden.organization_id_by_slug(p_org_slug)
    and p.slug = p_project_slug;
$$ language sql stable;

grant execute on function app_public.project_by_org_and_slug(text, text) to :DATABASE_VISITOR;

comment on function app_public.project_by_org_and_slug(text, text) is
  E'The project at this org and project slug, if the current visitor may see it.';
