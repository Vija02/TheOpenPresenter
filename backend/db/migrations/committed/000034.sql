--! Previous: sha1:4864a32a5efd145265d0edee743610105644d0a7
--! Hash: sha1:4e30346d4f69127d02e45e885e4d4ec051a19656

--! split: 1-current.sql
ALTER TABLE app_public.organizations 
DROP COLUMN IF EXISTS experimental_features_enabled;

ALTER TABLE app_public.organizations 
ADD COLUMN experimental_features_enabled boolean DEFAULT false NOT NULL;

-- Comment
COMMENT ON COLUMN app_public.organizations.experimental_features_enabled 
IS 'Whether an organization has enabled experimental features.';

-- Grants
GRANT UPDATE(experimental_features_enabled) ON TABLE app_public.organizations TO :DATABASE_VISITOR;
