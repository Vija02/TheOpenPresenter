--! Previous: sha1:c5bcf5347c9577685eb7e2f07f7060b380866311
--! Hash: sha1:01b593a9c47df56b185c295c10b71e684cef25dd

--! split: 1-current.sql
-- Enter migration here

--! split: 100-autologin-org-type.sql
-- Retroactive update auto login users (tauri) to church org
update app_public.organizations o
set organization_type = 'church'
where o.organization_type = 'venue'
  and exists (
    select 1
    from app_public.organization_memberships om
    join app_public.users u on u.id = om.user_id
    where om.organization_id = o.id
      and om.is_owner
      and u.username = 'autologin'
  );
