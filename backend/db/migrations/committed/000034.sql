--! Previous: sha1:4864a32a5efd145265d0edee743610105644d0a7
--! Hash: sha1:1ea0e0542a67a454bc441e5fa30add04a8674644

--! split: 1-current.sql
ALTER TABLE app_public.organizations 
ADD COLUMN experimental_features_enabled boolean DEFAULT false NOT NULL;

-- description
COMMENT ON COLUMN app_public.organizations.experimental_features_enabled 
IS 'Whether an organization has enabled experimental features.';

-- grant permissions
GRANT UPDATE(experimental_features_enabled) ON TABLE app_public.organizations TO theopenpresenter_visitor;
