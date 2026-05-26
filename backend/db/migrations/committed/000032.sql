--! Previous: sha1:7a935abc049a4e6a5c1596e07f09e6fccc4a6faa
--! Hash: sha1:ec61ae35e576ea526eb24d492faf392cd263971b

--! split: 1-current.sql
insert into app_public.organizations (slug, name, organization_type, is_public)
values ('demo', 'Demo', 'venue', true)
on conflict (slug) do nothing;
