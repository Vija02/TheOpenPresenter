--! Previous: sha1:47555000cf9236e4ef0b0a1ed4c782170432e69f
--! Hash: sha1:2aa6f37747ace9959253ab1d8b25fbd1757272df

--! split: 1-current.sql
grant update(name, slug, is_public) on app_public.organizations to :DATABASE_VISITOR;
